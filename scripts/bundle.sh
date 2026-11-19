#!/bin/sh
# Cloudflare builds have no PHP or compiler. Upload the committed runtime image.
set -eu
cd "$(dirname "$0")/.."
if [ ! -s runtime/dist/php.wasm ] || [ ! -s runtime/dist/php.mjs ]; then
    echo 'Missing runtime. Run sh runtime/build.sh locally and commit runtime/dist/.' >&2
    exit 1
fi
exec node runtime/manifest.mjs --check
