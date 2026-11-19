import assert from 'node:assert/strict';
import { acceptance } from './acceptance.mjs';
import { devServer } from './dev-server.mjs';

const server = await devServer('wrangler.toml');
try {
  await acceptance(request => {
    const url = new URL(request.url);
    return fetch(new Request(server.url + url.pathname + url.search, request));
  });
  // A mixed concurrent batch must serialize without cross-request state/output.
  await Promise.all(Array.from({ length: 40 }, async (_, i) => {
    const response = await fetch(server.url + (i % 2 ? '/' : '/api/products'));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Hermit Mug/);
  }));
  const large = await fetch(server.url + '/api/orders', { method: 'POST', body: 'x'.repeat(8 * 1024 * 1024) });
  assert.equal(large.status, 413);
  const head = await fetch(server.url + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(server.url + '/up')).status, 200, 'PHP still works after a rejected body');
  console.log('PASS concurrency, request limit, HEAD and recovery');
} catch (error) {
  console.error(server.log());
  throw error;
} finally {
  await server.close();
}
