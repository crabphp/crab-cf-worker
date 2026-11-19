/* One PHP request lifetime per isolate, like Crab's long-running server.
 * Wire format: little-endian uint32 lengths, followed by raw bytes (never JSON).
 * Request: method, target, header-count, (name,value)*, body.
 * Response: status, header-count, (name,value)*, body.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <php_embed.h>
#include <Zend/zend_exceptions.h>
#include <ext/random/php_random.h>
#include <ext/random/php_random_csprng.h>

static unsigned char *answer;
static size_t answer_size, answer_capacity;
static int booted;

static int append(const void *data, size_t size) {
    if (size > UINT32_MAX || answer_size + size > 16 * 1024 * 1024) return 0;
    if (answer_size + size > answer_capacity) {
        size_t capacity = (answer_size + size) * 2 + 1024;
        void *next = realloc(answer, capacity);
        if (!next) return 0;
        answer = next; answer_capacity = capacity;
    }
    memcpy(answer + answer_size, data, size);
    answer_size += size;
    return 1;
}
static int number(uint32_t n) {
    unsigned char bytes[4] = { n, n >> 8, n >> 16, n >> 24 };
    return append(bytes, 4);
}
static int string(zend_string *s) {
    return number(ZSTR_LEN(s)) && append(ZSTR_VAL(s), ZSTR_LEN(s));
}
static int read_number(const unsigned char **p, const unsigned char *end, uint32_t *n) {
    if (end - *p < 4) return 0;
    const unsigned char *b = *p;
    *n = (uint32_t)b[0] | (uint32_t)b[1] << 8 | (uint32_t)b[2] << 16 | (uint32_t)b[3] << 24;
    *p += 4; return 1;
}
static int read_string(const unsigned char **p, const unsigned char *end, zval *value) {
    uint32_t n;
    if (!read_number(p, end, &n) || n > (size_t)(end - *p)) return 0;
    ZVAL_STRINGL(value, (const char *)*p, n); *p += n;
    return 1;
}

int crab_init(void) {
    int status = 1;
    php_embed_module.php_ini_path_override = "/app/php.ini";
    php_embed_module.php_ini_ignore_cwd = 1;
    zend_try { status = php_embed_init(0, NULL) != SUCCESS; }
    zend_catch { status = 1; } zend_end_try();
    return status;
}

int crab_boot(void) {
    if (booted) return 0;
    int status = 1;
    zend_try {
        if (zend_eval_string("require '/app/worker.php';", NULL, "Crab boot") == SUCCESS && !EG(exception)) {
            booted = 1; status = 0;
        }
    } zend_catch { status = 1; } zend_end_try();
    return status;
}

int crab_request(const unsigned char *input, size_t length) {
    if (!booted || length > 8 * 1024 * 1024) return 1;
    answer_size = 0;
    SG(global_request_time) = 0;
    int status = 1;
    zval args[4], name, value, function, result;
    for (int i = 0; i < 4; i++) ZVAL_UNDEF(&args[i]);
    ZVAL_UNDEF(&name); ZVAL_UNDEF(&value); ZVAL_UNDEF(&function); ZVAL_UNDEF(&result);
    const unsigned char *p = input, *end = input + length;
    zend_try {
        uint32_t count;
        if (!read_string(&p, end, &args[0]) || !read_string(&p, end, &args[1]) ||
            !read_number(&p, end, &count) || count > 1024) goto done;
        array_init(&args[2]);
        for (uint32_t i = 0; i < count; i++) {
            if (!read_string(&p, end, &name) || !read_string(&p, end, &value)) goto done;
            zend_hash_update(Z_ARRVAL(args[2]), Z_STR(name), &value);
            ZVAL_UNDEF(&value); zval_ptr_dtor(&name); ZVAL_UNDEF(&name);
        }
        if (!read_string(&p, end, &args[3]) || p != end) goto done;
        ZVAL_STRING(&function, "crab_handle");
        if (call_user_function(EG(function_table), NULL, &function, &result, 4, args) != SUCCESS || EG(exception)) goto done;
        if (Z_TYPE(result) != IS_ARRAY) goto done;
        zval *code = zend_hash_index_find(Z_ARRVAL(result), 0);
        zval *headers = zend_hash_index_find(Z_ARRVAL(result), 1);
        zval *body = zend_hash_index_find(Z_ARRVAL(result), 2);
        if (!code || Z_TYPE_P(code) != IS_LONG || !headers || Z_TYPE_P(headers) != IS_ARRAY || !body || Z_TYPE_P(body) != IS_STRING) goto done;
        count = 0;
        zval *values, *header;
        zend_string *key;
        ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(headers), values) {
            if (Z_TYPE_P(values) != IS_ARRAY) goto done;
            count += zend_hash_num_elements(Z_ARRVAL_P(values));
        } ZEND_HASH_FOREACH_END();
        if (!number(Z_LVAL_P(code)) || !number(count)) goto done;
        ZEND_HASH_FOREACH_STR_KEY_VAL(Z_ARRVAL_P(headers), key, values) {
            if (!key) goto done;
            ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(values), header) {
                if (Z_TYPE_P(header) != IS_STRING || !string(key) || !string(Z_STR_P(header))) goto done;
            } ZEND_HASH_FOREACH_END();
        } ZEND_HASH_FOREACH_END();
        if (!string(Z_STR_P(body))) goto done;
        status = 0;
    done:
        if (EG(exception)) zend_exception_error(EG(exception), E_WARNING);
        for (int i = 0; i < 4; i++) zval_ptr_dtor(&args[i]);
        zval_ptr_dtor(&name); zval_ptr_dtor(&value); zval_ptr_dtor(&function); zval_ptr_dtor(&result);
    } zend_catch { status = 1; } zend_end_try();
    return status;
}

/* Snapshot only after boot, before any real request. Never freeze a cached
 * entropy descriptor, RNG seed, or wall-clock request timestamp. */
void crab_prepare_snapshot(void) {
    php_random_csprng_shutdown();
    RANDOM_G(combined_lcg_seeded) = false;
    RANDOM_G(mt19937_seeded) = false;
    memset(&RANDOM_G(fallback_seed_state), 0, sizeof(RANDOM_G(fallback_seed_state)));
    memset(&RANDOM_G(mt19937), 0, sizeof(RANDOM_G(mt19937)));
    memset(&RANDOM_G(combined_lcg), 0, sizeof(RANDOM_G(combined_lcg)));
    SG(global_request_time) = 0;
}

const unsigned char *crab_response(void) { return answer; }
size_t crab_response_size(void) { return answer_size; }

/* Build-time diagnostics and file-cache generation; not exposed by the Worker. */
int crab_eval(char *code) {
    int status = 1;
    zend_try { status = zend_eval_string(code, NULL, "Crab diagnostics") != SUCCESS || EG(exception); }
    zend_catch { status = 1; } zend_end_try();
    return status;
}
