# Brief: our own PHP runtime for Workers

Replace `php-cloud-wasm` with a minimal PHP 8.4 → WebAssembly build of our own, made for Crab on Cloudflare Workers. The goal is cold-start CPU: today a request that lands on a new isolate costs 450–1,073 ms of CPU (measured live with `wrangler tail`), against about 3 ms warm, and most requests land on new isolates.

Read first: `README.md`, `src/worker.js`, `worker.php`, `scripts/bundle.sh`, `wrangler.toml`. The application (`app/`, `routes/`, `resources/views/`, `config/`) stays as it is.

## Why not php-cloud-wasm

- It ships six PHP versions (74 MB installed, about 11 MB of WebAssembly per version), Vrzno (a JS bridge), zip and PDO-D1, none of which Crab needs.
- It is 32-bit: PHP integers stop at 2,147,483,647, so the framework's `Validator` (bound 2^53 − 1) cannot load and `bundle.sh` patches the vendored copy.
- It takes a Worker for Node when the compatibility date is later than 2025-05-05 and refuses to start, so the date is pinned.
- No `mbstring` (a polyfill stands in), no OPcache.
- The application is shipped as a zip, unpacked into PHP's filesystem and compiled from source on every new isolate.

Do not fork it. Build from `php-src` with Emscripten, with our own small embedding and JS glue. You may read `seanmorris/php-wasm` for reference.

## Requirements

1. **Reproducible build.** One script (`runtime/build.sh`) builds the runtime in a pinned container image (Docker or Podman are installed; `docker` is at `~/.local/bin/docker`). Pin the PHP 8.4 patch release, the Emscripten version and every library by version and checksum. The output goes to `runtime/dist/` and is committed, the way `dist/app.zip` is now, because Cloudflare's build machines have no PHP or Composer.
2. **One PHP, the extensions Crab uses and nothing else.** Find out which ones by running the application, not by guessing. Expect: Core, standard, date, pcre, json, ctype, hash, random, SPL, Reflection, filter, tokenizer and native `mbstring`. Drop the polyfill. OPcache if it can work in this build (see 5). No zip, Vrzno, sessions, PDO or network extensions.
3. **64-bit integers.** Try a wasm64 (`-sMEMORY64`) build. First establish, with evidence, whether Cloudflare's runtime (`workerd`) runs memory64 modules. Test it in `wrangler dev`, and give me a one-file deploy test for the live check, which the user runs. If 64-bit works, remove the `Validator` patch from `bundle.sh`. If it cannot work, say exactly why, keep 32-bit, and keep the patch.
4. **Our own embedding.** A small C entry point built on PHP's embed SAPI. Boot once per isolate: start PHP, then `require` the application, which loads `app.php` once. Then answer each request from a memory buffer the JS writes (method, target, headers, body) and return the status, headers and body the same way. No `/tmp/request.json`, no JSON round trip through PHP's output, no base64. The JS glue is our own ES module: no environment sniffing, so the compatibility date can move to the current one (remove the pin and its comment). Requests stay one at a time per isolate, as now.
5. **The application baked in.** Put `app/`, `config/`, `routes/`, `resources/` and the needed `vendor/` files into the module's filesystem at build time. No zip, no unpacking at run time. Then find the cheapest start that is correct, and measure each option:
   - Precompiled opcodes: OPcache's file cache, generated at build time and shipped in the image.
   - Fewer, larger files: only the classes a request loads.
   - A memory snapshot taken after boot (Wizer-style: run boot at build time and ship the initialised linear memory). It is the biggest possible win; say plainly whether it can work with Emscripten-built PHP.
6. **Measurement.** A local harness (`runtime/bench.mjs` or similar) that times, on a fresh instance each run: instantiating the module, booting PHP with the application, and the first and the tenth request to `/` and `/api/products`. Run it under `workerd` (`wrangler dev`) as well as Node, to measure the old and the new runtime the same way. The Worker's clock stands still while code runs on Cloudflare, so measure locally. Record the before and after numbers, and the module and upload sizes, in the README.

## Acceptance

All of these behave exactly as they do now, in `wrangler dev`:

- `GET /`: 200, the shop page.
- `GET /products/3`: 200. `GET /products/9`: 404 page.
- `GET /api/products` and `GET /api/products/2`: 200 JSON. `GET /api/products/9`: 404.
- `POST /api/orders` with JSON `{"product_id":1,"quantity":2,"email":"a@b.co"}`: 201. Quantity 99 with a bad email: 422 listing both errors. Product 4, which has no stock: 409.
- `GET /up`: 200.

Add these checks as a script (`npm test`) that starts `wrangler dev`, runs them and stops it.

Also required:

- The upload is under Cloudflare's 64 MiB limit and memory stays well under 128 MB per isolate; report both.
- Cold-start CPU (boot plus first request) is measured before and after. Aim for under 50 ms locally. If that is out of reach, report what was reached and what stands in the way.

## Constraints

- PHP 8.4 syntax only (no pipe operator).
- Do not change the `framework` or `arc` repositories. If Crab needs a change to run better here, write it up in the report instead.
- Commit to `main` in this repository in small, working steps, with plain commit messages, but **do not push**: a push deploys the live Worker. Claude reviews, then pushes.
- Keep `README.md` true as you go: how it works, how to build the runtime, the numbers and the limits.
- Delete `node_modules/php-cloud-wasm` from the dependencies once nothing uses it.

## Report

When done, or when blocked on something only the user can decide, write `runtime/REPORT.md`. Keep it short:

- What was built.
- The before and after numbers: sizes, cold start broken down by step, and warm request time.
- 64-bit: yes or no, and the evidence.
- Which start-up options worked and which did not, and why.
- Anything left open, and any framework changes worth making.
