# Crab on Cloudflare Workers

An experiment: a [Crab](https://github.com/crabphp/framework) shop inside a Cloudflare Worker, using our own minimal **PHP 8.4.27 wasm64 runtime**. Products live in code; two HTML pages and a small JSON API exercise routing, templates, dependency injection and validation.

> **Only an experiment.** Not supported, maintained or recommended for production. Crab is designed for its own long-lived server. The new runtime is much faster, but **Free's 10 ms request CPU budget is not demonstrated**; use Workers Paid pending live measurements.

## Live results

Live at <https://crab-cf-worker.daudau.workers.dev>, measured on 2026-11-19 on Workers Paid:

- **CPU per request** (`wrangler tail`): 1–5 ms on a warm isolate; 20–150 ms on a new one, mostly V8 compiling the WebAssembly code a request first runs. Plain PHP (`/raw`) and Crab cost the same warm; Crab's first request on an isolate costs more, because it runs more of the engine.
- **Load**: two minutes of mixed traffic, 128 requests in flight from one machine: 172,329 requests at 1,436 per second, p50 66 ms, p95 228 ms, no 500s.

| Route | What it shows |
| --- | --- |
| `/`, `/products/{id}` | Pages, as plain PHP templates |
| `/api/products`, `/api/products/{id}`, `POST /api/orders` | The JSON API, with validation |
| `/debug` | The runtime, extensions, request headers, and this isolate's request count and memory |
| `/debug/phpinfo` | `phpinfo()` |
| `/raw`, `/raw/api/products` | The same products in plain PHP, without Crab, to compare |

## Run

```sh
npm ci
npm run dev          # http://127.0.0.1:8787
npm test             # starts Wrangler, runs acceptance/concurrency checks, stops it
```

Running/deploying uses committed `runtime/dist/` and needs no PHP, Composer or compiler. The build hook checks source/artifact hashes and refuses stale bundles.

## Build

```sh
npm run runtime:build
```

Needs Docker (defaults to `~/.local/bin/docker`; set `CONTAINER_ENGINE=podman` if preferred), network access and several minutes on the first build. Rootless containers are supported. One script installs locked PHP dependencies, compiles PHP, runs the app to trace needed files, builds a class bundle, takes a post-boot snapshot, tests it, and writes `runtime/dist/`. Host PHP and Node 24 are not required: build-time tools are in pinned containers.

**After changing PHP or runtime inputs, rebuild and commit `runtime/dist/` with the change.** Cloudflare build machines only validate and upload these artifacts. Intermediates are ignored under `runtime/.build/`.

PHP's tarball, Emscripten image, Node build tool and Composer image are pinned by version/digest/checksum. Native libraries are bundled in the pinned PHP tarball or SDK; apt build tools use a dated repository snapshot. See [`runtime/SOURCES.md`](runtime/SOURCES.md). Repeated builds produced byte-identical Wasm, JS support and startup metadata. `dist/manifest.json` records input/artifact SHA-256 hashes; licenses are in `dist/licenses/`.

Alternative startup experiments use the same script:

```sh
RUNTIME_MODE=source  sh runtime/build.sh   # source files, no snapshot
RUNTIME_MODE=compact sh runtime/build.sh   # traced class bundle
RUNTIME_MODE=opcache sh runtime/build.sh   # target-generated OPcache file cache
sh runtime/build.sh                       # restore the selected snapshot build
```

These commands replace the local runtime artifacts; rebuild the default before committing/deploying.

## How it works

- PHP's embed SAPI is compiled with Emscripten 4.0.20 and `-sMEMORY64=1`. `PHP_INT_SIZE` is **8** and `PHP_INT_MAX` is **9,223,372,036,854,775,807**. The framework's Validator is unpatched.
- All application/config/routes/templates remain unchanged. Needed vendor files are discovered by executing acceptance and edge-case requests; unused vendor files are omitted. Adding application paths requires rebuilding and extending trace coverage.
- Strict PHP class files are combined, preserving `__DIR__` and `__FILE__`. Non-strict dependencies retain their original files and coercion semantics.
- At build time, PHP boots and `worker.php` requires `app.php`. Initialized linear memory and mutable Wasm globals become ordinary Wasm initializers. At runtime, our adapter restores that memory and recreates MEMFS, without rerunning C constructors or PHP boot. This is a **working Wizer-style snapshot**, not a V8 machine-code snapshot.
- Snapshot preparation closes the entropy descriptor and clears default PRNG seeds. Time and randomness are live after restore; independent instances are tested. No real requests or user data are baked into the image.
- `runtime/embed.c` calls `crab_handle(method, target, headers, body)` with Zend strings/arrays and reads its return value directly. Length-prefixed byte buffers carry requests/responses. **No zip, extraction, request files, JSON transport, base64 or Vrzno.** API JSON remains ordinary native PHP JSON.
- Our ES-module adapter statically imports Wasm. Generated Emscripten code supplies libc/MEMFS, with a fixed Worker environment and no Node sniffing. Compatibility date: **2026-11-19**.
- One interpreter per isolate; requests are serialized, including body reads. An interpreter that fails is discarded.

The 13 built/tested extensions are Core, standard, date, pcre, json, ctype, hash, random, SPL, Reflection, filter, tokenizer and native mbstring. Tokenizer also builds the class bundle. No mbstring polyfill, sessions, PDO, zip or network extensions. mbstring regex support is omitted, avoiding Oniguruma. OPcache works in the optional file-cache build but is unnecessary in the selected snapshot.

## Measurements

Five samples per route on this Linux host. The primary comparison below uses a **fresh workerd process for every sample**, not just a fresh PHP inside an already-warm engine. Node 24.11.1 likewise uses a fresh process. workerd version: 1.20261118.1; Wrangler: 4.165.0.

**Elapsed milliseconds**, including the harness's request/response wrapping. Compiled-module loading is outside the timed instance creation. Local workerd has 1 ms timer resolution; `<1` is not zero CPU. Medians are taken separately, so columns may not sum exactly.

| Runtime / engine / route | Instantiate + FS | PHP init | App boot | First request | Tenth request | Boot + first | Total incl. instantiate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Old / workerd / `/` | 54 | 37 | 279 | 26 | 2 | 343 | 397 |
| New / workerd / `/` | 21 | 0 | 0 | 32 | <1 | 32 | 53 |
| Old / workerd / `/api/products` | 54 | 37 | 278 | 22 | 1 | 337 | 391 |
| New / workerd / `/api/products` | 20 | 0 | 0 | 29 | <1 | 29 | 49 |
| Old / Node / `/` | 44.9 | 32.7 | 221.7 | 40.2 | 1.43 | 294.7 | 339.8 |
| New / Node / `/` | 21.7 | 0 | 0 | 59.2 | 0.68 | 59.2 | 81.0 |
| Old / Node / `/api/products` | 45.3 | 32.7 | 222.1 | 37.5 | 0.85 | 293.7 | 339.0 |
| New / Node / `/api/products` | 21.8 | 0 | 0 | 54.2 | 0.45 | 54.2 | 76.0 |

When only PHP is fresh and workerd/V8 is warm, new total latency is about **15–17 ms**. That is **not** a cold-isolate result. The gap demonstrates remaining engine first-use overhead. A linear-memory snapshot cannot store V8's compiled machine code.

Separate Node `process.cpuUsage()` runs measure **user + system CPU**, including background V8 compiler threads: boot + first fell from approximately **828 → 99 ms** for `/`, and **808 → 83 ms** for `/api/products`. These are process CPU figures, **not Cloudflare billing CPU**. Thus the under-50-ms target is not met uniformly, and the 10-ms Free limit is not proven. Moving pure initialization/warmup to module startup is a possible follow-up, not implemented or validated here.

Previously measured live with `wrangler tail`: **450–1,073 ms CPU cold**, about **3 ms warm** for the old runtime. **No new live CPU measurement or deployment has been performed.** Live Workers' clocks freeze during execution; use Workers Logs/tail for billing CPU, not `Date.now()` inside the Worker.

### Startup options

All three alternatives were implemented and exercised. Initial Node `/` comparisons, before final vendor trimming:

| Option | Boot + first | Total | Outcome |
| --- | ---: | ---: | --- |
| Minimal PHP, source files | 127 ms | 179 ms | Much faster than the old zip runtime |
| Larger traced class file | 137 ms | 193 ms | No standalone cold-start win; useful to prepare the snapshot |
| Build-time OPcache file cache | 100 ms | 167 ms | Works: 127 target-generated files, about 2 MB; extra image/FS cost offsets boot savings |
| Initialized memory + traced files | ~59 ms | ~81 ms | Selected; PHP/app boot removed, engine first-use cost remains |

OPcache is statically registered, file-cache-only, with no JIT or shared-memory requirement. It needs a small php-src change permitting embed SAPI. Its caches are generated by **the target wasm64 PHP**, never by host PHP.

### Size and memory

| | Old | Selected runtime |
| --- | ---: | ---: |
| Wasm | 11,505,886 B | 13,119,958 B, including initialized app state |
| Separate app zip | 916,249 B | None |
| Total upload, uncompressed | 13.26 MiB | 12.68 MiB |
| Total upload, gzip | 3.72 MiB | 3.39 MiB |
| Initial linear memory | 64 MiB | 32 MiB |

The current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) are **64 MiB uncompressed upload**, **128 MB per isolate**, and **10 ms request CPU on Free**. Upload size is comfortably below the limit.

After 1,000 alternating page/API requests, local workerd reported about **40 MiB accounted memory** (32 MiB Wasm plus allocated JS heap and reported host buffers). A near-limit 7 MiB order body was correctly rejected by validation with 422, at about **68 MiB accounted memory** and 46 MiB linear memory. These inspector sums exclude compiled-code/platform overhead; they are not complete live-isolate telemetry. PHP's ordinary acceptance peak is about 6 MiB, already inside the Wasm figure. Wasm is capped at 96 MiB and PHP allocations at 64 MiB.

### Reproduce checks

```sh
# Node 24+ for host-side PHP tools: Node 22 lacks the table64 support this module needs.
node --no-warnings --loader ./runtime/node-loader.mjs runtime/check.mjs
FRESH_WORKER=1 node runtime/bench.mjs new workerd
node runtime/bench.mjs new node
CPU=1 node runtime/bench.mjs new node
node runtime/memory.mjs

sh runtime/prepare-legacy.sh  # optional benchmark-only dependency, never production
FRESH_WORKER=1 node runtime/bench.mjs old workerd
node runtime/bench.mjs old node
node --no-warnings --loader ./runtime/node-loader.mjs runtime/compare.mjs
```

Raw samples, sizes, memory and reproducibility evidence are in `runtime/results/`. The old adapter uses the original app zip from commit `ac41c805`; its Node loader changes only the package's environment guard. The comparison checks 21 responses' status, headers and bodies, normalizing only random order IDs and the displayed PHP patch version.

## 64-bit and deployment

Both a memory64/table64 probe and the complete PHP runtime pass in local workerd. The separate live probe is **for the user to run**:

```sh
sh runtime/memory64-test.sh          # local
sh runtime/memory64-test.sh deploy   # separate crab-memory64-probe Worker
```

`npm run deploy` deploys the shop. A push may also deploy through Cloudflare's Git integration. This task commits locally but **does not push or deploy**. Confirm the live probe and measure actual cold billing CPU before relying on the new runtime.

## Remaining limits

- No processes, native Fiber stack switching, listening sockets, database/network extensions, scheduler or server workers. Unsupported process/Fiber operations fail explicitly. The synchronous shop does not start Fibers.
- No Arc: its compiler invokes `php -l`. Keep the existing plain PHP templates. Arc needs a stable ahead-of-time artifact API to work here.
- Request transport is bounded at 8 MiB, responses at 16 MiB; memory files are ephemeral. This is not a general-purpose PHP host.
- Zend's mmap/partial-munmap allocation is replaced with aligned `posix_memalign`/free chunks. This preserves Zend memory accounting and handles large, non-alignment-multiple allocations correctly.
- Crab eagerly loads several unused service/plugin classes. An opt-in lean application bootstrap could reduce the image further. Neither the framework nor Arc repository was changed.

See [`runtime/REPORT.md`](runtime/REPORT.md) for the final summary.
