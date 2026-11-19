// Benchmark-only adapter for the exact old runtime; never imported by production.
import { PhpCloudflare } from './.legacy/node_modules/php-cloud-wasm/PhpCloudflare.mjs';
import factory from './.legacy/node_modules/php-cloud-wasm/php8.4-cloudflare-runtime.mjs';
import wasmModule from './.legacy/node_modules/php-cloud-wasm/deb71e40613f78fd2604b467346dd585de473c2b.wasm';
import appZip from './.legacy/app.zip';

export async function legacy(clock = () => performance.now()) {
  const times = {};
  let output = '', errors = '';
  const t = clock();
  const php = new PhpCloudflare({ version: '8.4', wasmModule, runtime: async options => {
    const t0 = clock();
    const runtime = await factory(options);
    times.instantiate = clock() - t0;
    return runtime;
  }});
  php.addEventListener('output', event => { output += event.detail.join(''); });
  php.addEventListener('error', event => { errors += event.detail.join(''); });
  const binary = await php.binary;
  times.phpBoot = clock() - t - times.instantiate;
  const t0 = clock();
  await php.writeFile('/app.zip', new Uint8Array(appZip));
  const exit = await php.run(`<?php
    $zip = new ZipArchive();
    if ($zip->open('/app.zip') !== true || !$zip->extractTo('/app')) exit(1);
    $zip->close(); unlink('/app.zip');
    is_dir('/tmp') || mkdir('/tmp', 0777, true);
    require '/app/worker.php';
  `);
  if (exit) throw new Error(errors + output);
  times.appBoot = clock() - t0;
  return { times, memoryBytes: binary.HEAPU8.byteLength, async request(request) {
    const url = new URL(request.url);
    const bytes = new Uint8Array(await request.arrayBuffer());
    let body = '';
    for (const byte of bytes) body += String.fromCharCode(byte);
    await php.writeFile('/tmp/request.json', JSON.stringify({ method: request.method,
      target: url.pathname + url.search, headers: Object.fromEntries(request.headers), body: btoa(body) }));
    output = ''; errors = '';
    const exit = await php.run('<?php crab_handle();');
    if (exit) throw new Error(errors);
    const answer = JSON.parse(output);
    const headers = new Headers();
    for (const [key, values] of Object.entries(answer.headers)) for (const value of values) headers.append(key, value);
    return new Response(Uint8Array.from(atob(answer.body), c => c.charCodeAt(0)), { status: answer.status, headers });
  }};
}
