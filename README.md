# Crab on Cloudflare Workers

An experiment: a [Crab](https://github.com/crabphp/framework) application inside a Cloudflare Worker, on PHP 8.4 compiled to WebAssembly ([php-cloud-wasm](https://www.npmjs.com/package/php-cloud-wasm)). It is a pretend shop: two HTML pages and a small JSON API over products kept in code.

> **This is only an experiment.** It is not supported, not maintained and not a way to run Crab in production. It exists to find out what works when Crab runs on PHP compiled to WebAssembly; the limits it found are listed below. Crab is built to run as its own long-lived server.

## Status

| Route | Works |
| --- | --- |
| `GET /api/products` | Yes |
| `GET /api/products/{id}` | Yes |
| `POST /api/orders` | Yes, with validation |
| `GET /up` | Yes |
| `GET /`, `GET /products/{id}` | Yes, as plain PHP templates |

Measured on Cloudflare with `wrangler tail`: a request that lands on a new isolate uses 0.5 to 1 s of CPU (starting PHP, unpacking and loading the application); one on a warm isolate uses about 3 ms. Most requests landed on new isolates.

## Local runtime baseline

`npm test` starts Wrangler, checks all ten shop/API cases, and stops it. The
replacement-runtime task is in `runtime/BRIEF.md`. `runtime/memory64-test.sh`
proves memory64 works in local workerd 1.20261118.1; `sh runtime/memory64-test.sh deploy`
is an optional, separate live probe (not run automatically).

Reproduce the old runtime baseline with `sh runtime/prepare-legacy.sh`, then
`node runtime/bench.mjs old node` and `node runtime/bench.mjs old workerd`.
Five fresh PHP instances per route; medians in milliseconds, on this Linux host:

| Engine / route | Instantiate | PHP init | Unzip + app boot | First request | Tenth request | Boot + first |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Node 22 / `/` | 58.1 | 40.4 | 269.7 | 80.1 | 1.86 | 391.4 |
| Node 22 / `/api/products` | 57.9 | 40.4 | 314.4 | 76.2 | 1.29 | 429.3 |
| workerd / `/` | 18 | 5 | 191 | 13 | 1 | 208 |
| workerd / `/api/products` | 17 | 4 | 179 | 11 | <1 | 194 |

Raw samples: `runtime/results/old-*.json`. Node uses a fresh process per sample;
workerd reuses the compiled module but creates a fresh PHP instance. Local
workerd timers have 1 ms resolution; these are elapsed times, not billing CPU.
The first workerd sample (before V8 warms up) was 455 ms boot + first request.
Do not measure this with the frozen clock on live Workers. The old Wasm is
11,505,886 bytes; its app zip is 916,249 bytes; linear memory is 64 MiB.

## Run

Needs PHP 8.4 with Composer, Node 24, and `zip`.

```sh
npm install
npm run dev        # http://127.0.0.1:8787
```

`wrangler dev` and `wrangler deploy` run `scripts/bundle.sh` first, which installs the PHP dependencies and packs the application into `dist/app.zip`.

`dist/app.zip` is committed, because Cloudflare's build machines have no Composer: there, `bundle.sh` uses the committed bundle as it is. **After changing the application, run `npm run bundle` and commit `dist/app.zip` with the change.**

## Deploy

From this machine:

```sh
npx wrangler login
npm run deploy     # prints the *.workers.dev URL
npx wrangler tail  # live logs
```

Or from the Cloudflare dashboard, deploying on every push: **Workers & Pages → Create → Import a repository**, pick this repository, name the project `crab-cf-worker` (the `name` in `wrangler.toml`), leave the build command empty and keep the deploy command `npx wrangler deploy`.

The free plan allows 10 ms of CPU a request, which PHP's first request in an isolate exceeds; use the Workers Paid plan.

## How it works

- `src/worker.js` starts one PHP for each Worker isolate, unpacks `dist/app.zip` into PHP's filesystem and requires `worker.php`, which loads the application once.
- Each request is written to `/tmp/request.json`; `crab_handle()` builds a `Crab\Http\Request`, calls `$app->handle()` and prints the response as JSON, which the Worker turns back into a `Response`. PHP answers one request at a time per isolate.
- Crab's server, workers, queue, scheduler and WebSockets are not used: there are no processes or listening sockets in a Worker.

## Limits found

- **32-bit PHP.** Integers stop at 2,147,483,647. The framework's `Validator` bounds whole numbers at 2^53 − 1, which does not fit, so `scripts/bundle.sh` patches the bundled copy to cap it at `PHP_INT_MAX`.
- **No Arc.** The pages are plain PHP templates in `resources/views`, rendered by `App\Page`. Arc cannot compile a template here: it checks compiled code by starting `php -l`, and a Worker cannot start processes. Templates cannot be compiled ahead either: the cache key holds the exact PHP version (8.4.1 here) and the file's path. Using Arc would need a change in it, such as loading templates compiled at deploy time.
- **No MySQL.** PHP cannot open sockets to a database; Cloudflare D1 is reachable through PDO's `cfd1` driver.
- **Missing extensions.** No `mbstring` (the Symfony polyfill stands in), `sodium`, `openssl` or `iconv`; no OPcache.
- **Compatibility date pinned to 2025-05-05.** Later dates give Workers a Node-style `process`, which the PHP runtime takes for Node and refuses to start in.
