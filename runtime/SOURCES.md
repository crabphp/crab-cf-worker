# Pinned sources

No php-cloud-wasm/php-wasm code is linked, copied or forked. The old package is an optional benchmark-only install in `.legacy/`.

| Input | Version | Integrity pin |
| --- | --- | --- |
| PHP source | 8.4.27 | `php-8.4.27.tar.xz`, SHA-256 `dcf93923b0e38e0d5252b25b796520b5a47761a08b3488b6d0b5d1115764d3f0` (php.net release metadata) |
| Emscripten SDK + LLVM + sysroot | 4.0.20 | `emscripten/emsdk@sha256:460fff8f8ac87e11b16447fbd66538a686eafa0e4fb977aa0989ed19fe2079f7` |
| Node, build tools only | 24.11.1 | `node-v24.11.1-linux-x64.tar.xz`, SHA-256 `60e3b0a8500819514aca603487c254298cd776de0698d3cd08f11dba5b8289a8` (nodejs.org SHASUMS256) |
| Composer + host PHP, dependency install only | Image's exact contents | `composer@sha256:4d71c3c2109c61d5415544264b59ad4087e4c5b7244481723664138fd36d5040` |
| autoconf, bison, re2c, pkg-config | Ubuntu Jammy snapshot | Signed apt repository at `20251101T000000Z`, fixed in Dockerfile |
| PHP application dependencies | `composer.lock` versions and source commits | Committed lockfile; build manifest also hashes lockfile and application inputs |

PCRE2 **10.44**, timelib **2022.17**, libmbfl **1.3.2**, and PHP's bundled hash/random/standard implementations are taken directly from that PHP tarball. Their version and bytes are pinned together by its SHA-256, not fetched independently. Oniguruma, libzip, libxml, OpenSSL and database libraries are not built. Emscripten's libc (musl), compiler-rt, allocator and support libraries are fixed by the SDK image digest; no host Ubuntu libraries are linked into Wasm.

Builds target `linux/amd64` regardless of the container host. `SOURCE_DATE_EPOCH=1792540800`, UTC, fixed `/src` and `/app` paths, and deterministic snapshot-only host inputs remove build-time clock/entropy drift. Snapshot preparation closes the CSPRNG descriptor and clears default PRNG state. Runtime host clock and cryptographic entropy are never mocked.

`patch-php.py` makes two narrow platform changes: aligned allocation for Zend heap chunks (Emscripten cannot partially munmap), and allowing embed SAPI in OPcache's SAPI list for the optional file-cache experiment. It also normalizes configure's embedded container hostname/kernel labels for reproducibility. `platform.c` explicitly rejects unsupported process/Fiber operations. No Crab or Arc source repository is modified.

`dist/licenses/` contains PHP/Zend and bundled-library notices, Emscripten/musl/compiler-rt/libc++ notices, and Composer dependency licenses. `dist/manifest.json` records build-input and artifact SHA-256 hashes. The build hook refuses stale or modified artifacts.
