// The Worker: receives each request from Cloudflare, hands it to the Crab application running on
// PHP compiled to WebAssembly, and sends back what the application answers.
import { PhpCloudflare } from 'php-cloud-wasm/php8.4-cloudflare.mjs';
import appZip from '../dist/app.zip';

// One PHP for each isolate, with the application unpacked and loaded. A Worker isolate answers many
// requests, so only the first one pays for starting PHP and loading Crab.
let php = null;
let output = '';
let errors = '';

// PHP runs one request at a time; the others wait their turn.
let turn = Promise.resolve();

async function start() {
  const instance = new PhpCloudflare({});
  instance.addEventListener('output', event => { output += event.detail.join(''); });
  instance.addEventListener('error', event => { errors += event.detail.join(''); });

  await instance.writeFile('/app.zip', new Uint8Array(appZip));
  const exit = await instance.run(`<?php
    $zip = new ZipArchive();
    if ($zip->open('/app.zip') !== true || !$zip->extractTo('/app')) {
        fwrite(STDERR, 'The application could not be unpacked.');
        exit(1);
    }
    $zip->close();
    unlink('/app.zip');
    is_dir('/tmp') || mkdir('/tmp', 0777, true);
    require '/app/worker.php';
  `);
  if (exit !== 0) {
    throw new Error(`PHP could not load the application (${exit}): ${errors} ${output}`);
  }
  return instance;
}

async function handle(request) {
  php ??= await start();

  const url = new URL(request.url);
  await php.writeFile('/tmp/request.json', JSON.stringify({
    method: request.method,
    target: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
    body: base64(new Uint8Array(await request.arrayBuffer())),
  }));

  output = '';
  errors = '';
  const exit = await php.run('<?php crab_handle();');
  if (errors !== '') {
    console.error(errors);
  }
  if (exit !== 0) {
    throw new Error(`PHP stopped with ${exit}: ${errors}`);
  }

  const answer = JSON.parse(output);
  const headers = new Headers();
  for (const [name, values] of Object.entries(answer.headers)) {
    for (const value of values) {
      headers.append(name, value);
    }
  }
  // A response without content, such as 204 or 304, must be given no body at all.
  const body = [101, 204, 205, 304].includes(answer.status) ? null : bytes(answer.body);
  return new Response(body, { status: answer.status, headers });
}

function base64(data) {
  let binary = '';
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function bytes(encoded) {
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}

export default {
  async fetch(request) {
    const answer = turn.then(() => handle(request));
    // The next request waits for this one whether it worked or not.
    turn = answer.catch(() => {});
    try {
      return await answer;
    } catch (error) {
      // A PHP that failed may be left half-loaded: start a new one for the next request.
      php = null;
      console.error(error);
      return new Response('The application failed.\n', { status: 500 });
    }
  },
};
