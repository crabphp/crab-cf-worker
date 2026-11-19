# Crab on Cloudflare Workers

An experiment: a [Crab](https://github.com/crabphp/framework) shop inside a Cloudflare Worker, using our own minimal PHP 8.4.27 WebAssembly build. Products live in code; two HTML pages and a small JSON API exercise routing, templates, dependency injection and validation.

> **Only an experiment.** Not supported or maintained, and not a production deployment model for Crab. Crab is designed for its own long-lived server.

## Run and build

```sh
npm ci
npm run dev          # http://127.0.0.1:8787
npm test             # starts Wrangler, checks all ten acceptance cases, stops it
npm run runtime:build
```

Running needs Node and the committed `runtime/dist/`; it does not need PHP or Composer. Building needs Docker (defaults to `~/.local/bin/docker`, override `CONTAINER_ENGINE`), network access and several minutes on the first run. `runtime/build.sh` pins the Emscripten image by digest, PHP 8.4.27 by SHA-256, Composer's image by digest and PHP dependencies by `composer.lock`. PCRE2, timelib and libmbfl come from the pinned PHP tarball; no external libraries are linked. Build tools use a dated Ubuntu package snapshot.

**After changing PHP code or runtime sources, run `npm run runtime:build` and commit `runtime/dist/` with the change.** Cloudflare's build machines upload these committed artifacts; they do not run PHP, Composer or Emscripten. Build intermediates stay in ignored `runtime/.build/`.

## How it works

- One PHP 8.4 embed SAPI per isolate, built with Emscripten 4.0.20 and genuine wasm64 pointers/integers. `PHP_INT_SIZE` is 8; the framework's Validator needs no patch.
- Application and vendor files are compiled into the Wasm filesystem. No zip, extraction, Vrzno or PDO bridge.
- `runtime/embed.c` starts PHP, requires `worker.php` once, then calls `crab_handle(method, target, headers, body)` with Zend values. A length-prefixed byte buffer carries requests and responses. No request file, JSON transport or base64.
- Our ES-module adapter uses static Wasm imports. The generated Emscripten libc/MEMFS support is fixed to the Worker environment, with no Node detection. Compatibility date: 2026-11-19.
- Requests are serialized, including boot and body reads. A failed interpreter is discarded.
- Extensions verified by running the application: Core, standard, date, pcre, json, ctype, hash, random, SPL, Reflection, filter, tokenizer and native mbstring. No mbstring polyfill, sessions, PDO, zip or network extensions. mbstring regex support is omitted (no Oniguruma).

## Measurements

Five fresh instances per route, medians in milliseconds on this Linux host. Node 24.11.1 uses a fresh process per sample; workerd 1.20261118.1 reuses its compiled module but creates a fresh PHP instance. Local workerd timers resolve to 1 ms. These are local elapsed times, not billing CPU; **live Workers clocks freeze during execution**.

| Runtime / engine / route | Instantiate | PHP init | App boot | First | Tenth | Boot + first |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Old / Node / `/` | 44.9 | 32.7 | 221.7 | 40.2 | 1.43 | 294.7 |
| Old / Node / `/api/products` | 45.3 | 32.7 | 222.1 | 37.5 | 0.85 | 293.7 |
| New source / Node / `/` | 50.9 | 23.0 | 72.7 | 31.7 | 0.65 | 127.3 |
| New source / Node / `/api/products` | 51.4 | 22.9 | 72.8 | 30.4 | 0.43 | 126.5 |
| Old / workerd / `/` | 18 | 5 | 191 | 13 | 1 | 208 |
| Old / workerd / `/api/products` | 17 | 4 | 179 | 11 | <1 | 194 |
| New source / workerd / `/` | 37 | 3 | 24 | 6 | 1 | 33 |
| New source / workerd / `/api/products` | 34 | 3 | 21 | 5 | 1 | 29 |

Old Wasm: 11,505,886 bytes plus a 916,249-byte app zip; 64 MiB linear memory. New source build: about 8 MiB Wasm including the app; 32 MiB initial linear memory (96 MiB hard cap), 4 MiB peak PHP-managed memory during acceptance. More startup experiments are in progress; the target is below 50 ms including cold PHP boot plus first request.

```sh
# Node 24+ is required for wasm64 tables (Node 22 cannot compile them).
node runtime/bench.mjs new node
node runtime/bench.mjs new workerd
sh runtime/prepare-legacy.sh  # optional isolated benchmark dependency, not production
node runtime/bench.mjs old node
node runtime/bench.mjs old workerd
```

Raw samples are in `runtime/results/`. The old adapter uses the exact old app zip from commit `ac41c805`; its Node loader bypasses only the package's environment guard. The first old workerd sample before V8 warmed up cost 455 ms boot + first. Previously measured live with `wrangler tail`: 450–1,073 ms CPU cold, about 3 ms warm. New live CPU has **not** been measured.

## 64-bit probe

Local workerd accepts both the memory64 probe and this complete wasm64 PHP runtime. A standalone live test is available; it uses its own Worker name and never reads the production configuration:

```sh
sh runtime/memory64-test.sh          # local probe
sh runtime/memory64-test.sh deploy   # optional live probe, only when you choose
```

The live probe has not been deployed by this task. Node 22's experimental memory64 support lacks table64; use Node 24+ for local PHP tools.

## Deploy and limits

`npm run deploy` deploys the shop. A push may also deploy through Cloudflare's Git integration. This runtime task commits locally but **does not push or deploy**.

- Use the Workers Paid plan; the 10 ms free CPU budget is too small for a cold PHP request.
- No processes, network extensions, database connections, scheduler or server workers. Native Fiber stack switching is unavailable; starting a Fiber is unsupported. The synchronous application path does not start one.
- No Arc: its compiler starts `php -l`; use the existing plain PHP templates. Arc would need an ahead-of-time artifact API with stable paths/version metadata.
- Bodies are capped at 8 MiB at the embed ABI. This experiment is not a general-purpose PHP hosting environment.
- A small php-src allocator patch replaces mmap/partial-munmap chunk alignment with aligned allocation. Emscripten cannot partially unmap allocations. Zend's allocator and PHP memory accounting remain active.
- OPcache and initialized-memory snapshots are being evaluated separately; no claims of support until tested.
