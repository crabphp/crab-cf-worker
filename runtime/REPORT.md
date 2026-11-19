# Runtime report

## Built

Our own PHP **8.4.27 / Emscripten 4.0.20 wasm64 embed**, with 13 extensions including native mbstring. A binary-buffer ABI replaces request files, JSON/base64 transport and Vrzno. No zip, sessions, PDO or network extensions. `php-cloud-wasm` and the mbstring polyfill are removed from production dependencies.

The selected build bakes in the application and **snapshots PHP after boot**. It restores initialized linear memory/globals and recreates MEMFS without rerunning PHP or C initialization. Entropy descriptors/PRNG seeds are cleared before capture; restored time and randomness are tested. Application, framework and Arc sources remain unchanged (only this repository's embedding/build files change).

`runtime/build.sh` pins sources/toolchains and produces committed artifacts. Two identical-input builds produced byte-identical Wasm/JS/startup metadata. Tests include all ten acceptance cases in Wrangler, concurrency, HEAD, body limits, large allocations, independent randomness, and 21 old/new response comparisons. Only order IDs and the displayed PHP patch version differ in that comparison.

## Before → after

Five-sample medians; fresh **workerd process per sample**. Local elapsed ms, **not billing CPU**:

| Route | Instantiate + FS | PHP init | App load | First | Tenth | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 54 → 21 | 37 → 0 | 279 → 0 | 26 → 32 | 2 → <1 | 397 → 53 |
| `/api/products` | 54 → 20 | 37 → 0 | 278 → 0 | 22 → 29 | 1 → <1 | 391 → 49 |

- Node 24, fresh process: total approximately **340 → 81 ms** (HTML), **339 → 76 ms** (API); warm about **0.7 / 0.4 ms**.
- Separate Node process CPU accounting, including compiler threads: boot + first approximately **828 → 99 ms** / **808 → 83 ms**. It is not Cloudflare's per-invocation accounting.
- Wasm: **11.51 MB + 0.92 MB zip → about 13.1 MB**, including initialized state. Total upload: **13.26 → 12.68 MiB**, gzip **3.72 → 3.39 MiB**; comfortably below **64 MiB uncompressed**.
- Initial linear memory: **64 → 32 MiB**. After 1,000 requests, about **40 MiB accounted memory**; a 7 MiB input exercised **46 MiB linear / ~68 MiB accounted memory**. Inspector sums exclude compiled-code/platform overhead, but both workloads are well below 128 MB. PHP-managed ordinary acceptance peak is about 6 MiB, inside linear memory.

Raw samples and exact sizes/hashes: `runtime/results/`; commands/methodology: root README.

## 64-bit: yes locally; live check outstanding

Local workerd **1.20261118.1** accepts both memory64 and table64, and the full runtime passes with `PHP_INT_SIZE=8`, `PHP_INT_MAX=9223372036854775807`, and the original Validator bound. Node 22 cannot load its table64 module; Node 24 works. Compatibility date moved to **2026-11-19**.

The user can run **`sh runtime/memory64-test.sh deploy`**. It deploys a separate `crab-memory64-probe`, not the shop. **No live deployment or push was performed.**

## Startup options

- **Source files:** works; removes zip/bridge overhead. Initial Node cold boot + first was ~127 ms.
- **Fewer/larger files:** works after dependency/covariance ordering and preserving non-strict files' semantics. Initial standalone comparison (~137 ms) did not beat plain source. Useful for the selected snapshot; unused vendor files are traced/pruned.
- **OPcache file cache:** works, statically registered and file-cache-only, without JIT/shared-memory operation. Target wasm64 PHP generated 127 cache files (~2 MB). Cold boot improved (~100 ms Node), but larger image/FS setup diluted the gain. Not shipped in the selected runtime.
- **Post-boot snapshot:** **works with Emscripten PHP**, using our small capture/restore tool rather than stock Wizer. Imported JS filesystem state must be recreated and constructors skipped. This was the best option. It cannot capture V8's compiled machine code.

## Open

The under-50-ms goal is not met uniformly: engine first-use work remains, especially in fresh Node processes. Warm-engine/fresh-PHP measurements are much lower and must not be mistaken for cold isolates. **Free's 10 ms request CPU limit is not proven; use Paid pending live CPU measurements.** Pure module-startup initialization/warmup under Cloudflare's separate startup budget is a possible next experiment, not implemented or guaranteed.

There are no native Fibers, processes or external sockets. The image is traced for this shop, not arbitrary PHP: new application paths need new trace coverage and a rebuild. Framework follow-ups worth considering: opt-in lean bootstrap instead of eagerly loading unused plugins; Arc ahead-of-time template artifacts with stable path/version metadata. Neither repository was modified.
