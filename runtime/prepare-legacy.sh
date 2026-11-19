#!/bin/sh
# Benchmark dependency only; never part of a production install or upload.
set -eu
cd "$(dirname "$0")/.."
mkdir -p runtime/.legacy
npm install --prefix runtime/.legacy --no-save --package-lock=false --ignore-scripts php-cloud-wasm@0.2.0
git show ac41c805db61e023c0a66a897b31ecc8d08b7f39:dist/app.zip > runtime/.legacy/app.zip
