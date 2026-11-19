// Optional fidelity check against the frozen old app/runtime. Prepare .legacy first.
import assert from 'node:assert/strict';
import { legacy } from './legacy.mjs';
import { create } from './new.mjs';
import { cases } from './acceptance.mjs';

const old = await legacy(), next = await create();
const requests = cases.map(([method, path, , body]) => [method, path, body && JSON.stringify(body)]);
requests.push(['GET', '/absent'], ['OPTIONS', '/api/products'], ['DELETE', '/api/products/2'],
  ['GET', '/products/nope'], ['GET', '/api/products/-1'], ['GET', '/api/products?x=%FF'],
  ['POST', '/api/orders', '{bad'], ['POST', '/api/orders', '{}'],
  ['POST', '/api/orders', '{"product_id":99,"quantity":1,"email":"a@b.co"}'],
  ['POST', '/api/orders', '{"product_id":1,"quantity":1,"email":"é@b.co"}'],
  ['POST', '/api/orders', '{"product_id":1,"quantity":1,"email":"a@b.co","extra":"🦀"}']);
for (const [method, path, body] of requests) {
  const request = new Request(`http://localhost${path}`, { method, body,
    headers: { 'content-type': 'application/json', accept: 'application/json' } });
  const a = await old.request(request.clone()), b = await next.request(request);
  assert.equal(b.status, a.status, `${method} ${path}: status`);
  assert.deepEqual([...b.headers], [...a.headers], `${method} ${path}: headers`);
  const normalize = text => text.replace(/ord_[a-f0-9]{12}/g, 'ord_RANDOM')
    .replace(/Rendered on PHP 8\.4\.\d+/, 'Rendered on PHP 8.4.PATCH');
  assert.equal(normalize(await b.text()), normalize(await a.text()), `${method} ${path}: body`);
}
console.log(`PASS ${requests.length} old/new status, headers and body comparisons (only order IDs and the displayed PHP patch version normalized)`);
