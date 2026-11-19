#!/bin/sh
# A disposable, separate Worker. No production config is read or modified.
# Local: sh runtime/memory64-test.sh
# Live (only when you choose): sh runtime/memory64-test.sh deploy
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d "$root/runtime/.memory64-XXXXXX")
trap 'rm -rf "$dir"' EXIT INT TERM
# (module (table i64 1 funcref) (memory (export "memory") i64 1)
#   (func (export "probe") (result i64) i64.const 9007199254740991))
python3 - "$dir/probe.wasm" <<'PY'
import sys
from pathlib import Path
Path(sys.argv[1]).write_bytes(bytes.fromhex(
 '0061736d01000000' '0105016000017e' '03020100' '040401700401' '0503010401'
 '071202066d656d6f727902000570726f62650000'
 '0a0d010b0042ffffffffffffff0f0b'))
PY
cat > "$dir/worker.js" <<'JS'
import module from './probe.wasm';
export default { fetch() {
  try {
    const { exports } = new WebAssembly.Instance(module);
    const value = exports.probe();
    return Response.json({ memory64: value === 9007199254740991n, table64: true, value: String(value), bytes: exports.memory.buffer.byteLength });
  } catch (error) { return Response.json({ memory64: false, error: String(error) }, {status: 500}); }
}};
JS
cat > "$dir/wrangler.toml" <<'TOML'
name = "crab-memory64-probe"
main = "worker.js"
compatibility_date = "2026-11-19"
TOML
cd "$root"
case "${1:-dev}" in
 dev) exec_cmd='dev';; deploy) exec_cmd='deploy';; *) echo 'Use dev or deploy' >&2; exit 1;;
esac
node node_modules/wrangler/bin/wrangler.js "$exec_cmd" --config "$dir/wrangler.toml"
