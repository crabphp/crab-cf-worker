import { readFile, writeFile } from 'node:fs/promises';
import { create } from './new.mjs';
import { acceptance } from './acceptance.mjs';
const runtime = await create();
await acceptance(request => runtime.request(request));
const edgeCases = [
  ['GET', '/absent'], ['HEAD', '/'], ['OPTIONS', '/api/products'], ['DELETE', '/api/products/2'],
  ['GET', '/products/nope'], ['GET', '/api/products/-1'], ['GET', '/api/products?x=%FF'],
  ['POST', '/api/orders', '{bad'], ['POST', '/api/orders', '{}'],
  ['POST', '/api/orders', '{"product_id":99,"quantity":1,"email":"a@b.co"}'],
  ['POST', '/api/orders', '{"product_id":1,"quantity":1,"email":"é@b.co"}'],
  ['POST', '/api/orders', '{"product_id":1,"quantity":1,"email":"a@b.co","extra":"🦀"}'],
];
for (const [method, path, body] of edgeCases) {
  const response = await runtime.request(new Request(`http://localhost${path}`, { method, body,
    headers: { accept: 'application/json', 'content-type': 'application/json' } }));
  console.log(method, path, response.status); await response.arrayBuffer();
}
runtime.evaluate((await readFile('runtime/compact.php', 'utf8')).replace(/^<\?php\s*/, ''));
await writeFile('runtime/.build/trace.json', runtime.php.FS.readFile('/tmp/trace.json'));
await writeFile('runtime/.build/app/classes.php', runtime.php.FS.readFile('/app/classes.php'));
const worker = (await readFile('worker.php', 'utf8')).replace("require __DIR__ . '/vendor/autoload.php';", "require __DIR__ . '/vendor/autoload.php';\nrequire __DIR__ . '/classes.php';");
await writeFile('runtime/.build/app/worker.php', worker);
console.log('Wrote traced class bundle and file manifest.');
