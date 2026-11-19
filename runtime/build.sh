#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "${1:-}" != --inside ]; then
    engine=${CONTAINER_ENGINE:-$HOME/.local/bin/docker}
    "$engine" build -t crab-php-wasm-toolchain -f runtime/Dockerfile runtime
    mkdir -p runtime/.build runtime/dist
    if [ "${RELINK_ONLY:-0}" != 1 ]; then
        rm -rf runtime/.build/app
        mkdir -p runtime/.build/app
        cp -R app app.php config resources routes composer.json composer.lock runtime/.build/app/
        cp worker.php runtime/.build/app/worker.php
        cp runtime/php.ini runtime/.build/app/php.ini
        "$engine" run --rm -e COMPOSER_ALLOW_SUPERUSER=1 \
            -v "$PWD/runtime/.build/app:/app" -w /app \
            composer:2@sha256:4d71c3c2109c61d5415544264b59ad4087e4c5b7244481723664138fd36d5040 \
            install --no-dev --no-interaction --no-progress --no-scripts --no-plugins --optimize-autoloader
    fi
    exec "$engine" run --rm \
        -e HOME=/tmp -e OPCACHE="${OPCACHE:-0}" \
        -v "$PWD:/src" -w /src crab-php-wasm-toolchain sh runtime/build.sh --inside
fi
export SOURCE_DATE_EPOCH=1792540800 TZ=UTC LC_ALL=C
version=8.4.27
sha=dcf93923b0e38e0d5252b25b796520b5a47761a08b3488b6d0b5d1115764d3f0
build=/src/runtime/.build
export EM_CACHE="$build/em-cache"
mkdir -p "$build"
cd "$build"
if [ ! -f "php-$version.tar.xz" ]; then
    curl -fL --retry 3 "https://www.php.net/distributions/php-$version.tar.xz" -o "php-$version.tar.xz"
fi
printf '%s  %s\n' "$sha" "php-$version.tar.xz" | sha256sum -c -
if [ ! -d "php-$version" ]; then tar -xf "php-$version.tar.xz"; fi
cd "php-$version"
python3 /src/runtime/patch-php.py "$PWD"
if [ ! -f Makefile ]; then
    # wasm64: LP64, so zend_long and PHP integers are genuinely 64-bit.
    emconfigure ./configure --host=wasm64-unknown-emscripten --build=x86_64-pc-linux-gnu \
        --disable-all --disable-cli --disable-cgi --disable-phpdbg --enable-embed=static \
        --enable-ctype --enable-filter --enable-tokenizer --enable-mbstring --disable-mbregex \
        --disable-opcache --without-pear --without-pcre-jit \
        CFLAGS='-O2 -sMEMORY64=1 -Wno-incompatible-function-pointer-types' \
        LDFLAGS='-sMEMORY64=1' \
        ac_cv_func_getrandom=no ac_cv_func_arc4random_buf=no \
        ac_cv_func_dlopen=no ac_cv_func_dlsym=no
fi
emmake make -j4
extra=''
if [ "${OPCACHE:-0}" = 1 ]; then
    extra='/src/runtime/opcache.c ext/opcache/ZendAccelerator.c ext/opcache/zend_*.c ext/opcache/shared_alloc_mmap.c -DHAVE_SHM_MMAP_ANON=1 -Wl,--wrap=zend_startup_extensions'
fi
# Word splitting here deliberately expands the fixed source list above.
emcc -O2 -D_GNU_SOURCE -sMEMORY64=1 /src/runtime/embed.c /src/runtime/platform.c $extra libs/libphp.a \
    -I. -Imain -IZend -ITSRM -Isapi/embed \
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker -sASSERTIONS=0 \
    -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sMAXIMUM_MEMORY=100663296 \
    -sSTACK_SIZE=1048576 -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 \
    -sEXPORTED_FUNCTIONS='["_crab_init","_crab_boot","_crab_request","_crab_response","_crab_response_size","_crab_eval","_malloc","_free"]' \
    -sEXPORTED_RUNTIME_METHODS='["FS","HEAPU8"]' \
    --embed-file /src/runtime/.build/app@/app \
    --no-entry -o /src/runtime/dist/php.mjs
