#!/bin/sh
# One entry point: pinned toolchain, locked dependencies, selected startup image.
set -eu
cd "$(dirname "$0")/.."
mode=${RUNTIME_MODE:-snapshot}
case "$mode" in source|compact|opcache|snapshot) ;; *) echo 'RUNTIME_MODE must be source, compact, opcache, or snapshot' >&2; exit 1;; esac
if [ "${1:-}" != --inside ]; then
    engine=${CONTAINER_ENGINE:-$HOME/.local/bin/docker}
    security=$("$engine" info --format '{{json .SecurityOptions}}' 2>/dev/null || true)
    rootless=$("$engine" info --format '{{.Host.Security.Rootless}}' 2>/dev/null || true)
    case "$security $rootless" in
        *rootless*|*true*) identity=0:0 ;; # Container root maps to the host user.
        *) identity="$(id -u):$(id -g)" ;;
    esac
    "$engine" build --platform linux/amd64 -t crab-php-wasm-toolchain -f runtime/Dockerfile runtime
    mkdir -p runtime/.build runtime/dist
    rm -rf runtime/.build/app
    mkdir -p runtime/.build/app
    cp -R app app.php config resources routes composer.json composer.lock worker.php runtime/.build/app/
    cp runtime/php.ini runtime/.build/app/php.ini
    "$engine" run --rm --platform linux/amd64 --user "$identity" -e HOME=/tmp -e COMPOSER_HOME=/tmp/composer -e COMPOSER_ALLOW_SUPERUSER=1 \
        -v "$PWD/runtime/.build/app:/app" -w /app \
        composer:2@sha256:4d71c3c2109c61d5415544264b59ad4087e4c5b7244481723664138fd36d5040 \
        install --no-dev --no-interaction --no-progress --no-scripts --no-plugins --optimize-autoloader
    exec "$engine" run --rm --platform linux/amd64 --user "$identity" -e HOME=/tmp -e RUNTIME_MODE="$mode" \
        -v "$PWD:/src" -w /src crab-php-wasm-toolchain sh runtime/build.sh --inside
fi
export SOURCE_DATE_EPOCH=1792540800 TZ=UTC LC_ALL=C
version=8.4.27
sha=dcf93923b0e38e0d5252b25b796520b5a47761a08b3488b6d0b5d1115764d3f0
build=/src/runtime/.build
export EM_CACHE="$build/em-cache"
node=/opt/node/bin/node
mkdir -p "$build"
cd "$build"
if [ ! -f "php-$version.tar.xz" ]; then
    curl -fL --retry 3 "https://www.php.net/distributions/php-$version.tar.xz" -o "php-$version.tar.xz"
fi
printf '%s  %s\n' "$sha" "php-$version.tar.xz" | sha256sum -c -
if [ ! -d "php-$version" ]; then tar -xf "php-$version.tar.xz"; fi
cd "php-$version"
python3 /src/runtime/patch-php.py "$PWD"
python3 /src/runtime/licenses.py "$PWD"
config_key=$( { sed -n '/^    emconfigure /,/^fi$/p' /src/runtime/build.sh; printf '%s\n' "$sha"; emcc --version; } | sha256sum | cut -d ' ' -f 1)
if [ -f Makefile ] && [ "$(cat .crab-config-key 2>/dev/null || true)" != "$config_key" ]; then
    emmake make distclean
fi
if [ ! -f Makefile ]; then
    # LP64: zend_long, pointers and PHP integers are genuinely 64-bit.
    emconfigure ./configure --host=wasm64-unknown-emscripten --build=x86_64-pc-linux-gnu \
        --disable-all --disable-cli --disable-cgi --disable-phpdbg --enable-embed=static \
        --enable-ctype --enable-filter --enable-tokenizer --enable-mbstring --disable-mbregex \
        --disable-opcache --without-pear --without-pcre-jit \
        CFLAGS='-O2 -sMEMORY64=1 -Wno-incompatible-function-pointer-types' \
        LDFLAGS='-sMEMORY64=1' \
        ac_cv_func_getrandom=no ac_cv_func_arc4random_buf=no \
        ac_cv_func_dlopen=no ac_cv_func_dlsym=no
fi
printf '%s\n' "$config_key" > .crab-config-key
python3 /src/runtime/patch-php.py "$PWD"
emmake make -j4
extra=''
if [ "$mode" = opcache ]; then
    cat /src/runtime/opcache.ini >> "$build/app/php.ini"
    mkdir -p "$build/app/opcache"
    touch "$build/app/opcache/.keep"
    extra='/src/runtime/opcache.c ext/opcache/ZendAccelerator.c ext/opcache/zend_*.c ext/opcache/shared_alloc_mmap.c -DHAVE_SHM_MMAP_ANON=1 -Wl,--wrap=zend_startup_extensions'
fi
link() {
    # Word splitting deliberately expands the fixed source list above.
    emcc -O2 -D_GNU_SOURCE -sMEMORY64=1 /src/runtime/embed.c /src/runtime/platform.c $extra libs/libphp.a \
        -I. -Imain -IZend -ITSRM -Isapi/embed \
        -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker -sASSERTIONS=0 \
        -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=100663296 \
        -sSTACK_SIZE=1048576 -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 \
        -sEXPORTED_FUNCTIONS='["_crab_init","_crab_boot","_crab_request","_crab_response","_crab_response_size","_crab_eval","_crab_prepare_snapshot","_malloc","_free"]' \
        -sEXPORTED_RUNTIME_METHODS='["FS","HEAPU8"]' \
        --embed-file "$build/app@/app" --no-entry -o /src/runtime/dist/php.mjs
    chmod 644 /src/runtime/dist/php.wasm
}
# The adapter is the same in all experiments; only these build outputs differ.
printf 'export default null;\n' > /src/runtime/dist/startup.mjs
link
case "$mode" in
    compact|snapshot)
        (cd /src && "$node" --no-warnings --loader ./runtime/node-loader.mjs runtime/trace.mjs && "$node" runtime/prune.mjs)
        link
        ;;
    opcache)
        (cd /src && "$node" --no-warnings --loader ./runtime/node-loader.mjs runtime/cache-opcodes.mjs)
        link
        ;;
esac
if [ "$mode" = snapshot ]; then
    "$node" /src/runtime/snapshot.mjs /src/runtime/dist/php "$build/snapshot"
    mv "$build/snapshot.wasm" /src/runtime/dist/php.wasm
    printf 'export default ' > /src/runtime/dist/startup.mjs
    tr -d '\n' < "$build/snapshot.json" >> /src/runtime/dist/startup.mjs
    printf ';\n' >> /src/runtime/dist/startup.mjs
fi
(cd /src && "$node" --no-warnings --loader ./runtime/node-loader.mjs runtime/check.mjs && "$node" runtime/manifest.mjs "$mode")
echo "Built $mode runtime in runtime/dist/. Run npm test before committing."
