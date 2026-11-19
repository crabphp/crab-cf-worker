import assert from 'node:assert/strict';
import { create } from './new.mjs';
import { acceptance } from './acceptance.mjs';

const runtime = await create();
await acceptance(request => runtime.request(request));
runtime.evaluate(`
if (PHP_INT_SIZE !== 8 || PHP_INT_MAX !== 9223372036854775807) throw new Exception('Not 64-bit');
if (mb_strlen('🦀é', 'UTF-8') !== 2) throw new Exception('mbstring failed');
echo json_encode(['php' => PHP_VERSION, 'intSize' => PHP_INT_SIZE, 'extensions' => get_loaded_extensions(), 'phpMemory' => memory_get_peak_usage(true), 'files' => get_included_files()], JSON_THROW_ON_ERROR), "\\n";
`);
const ids = new Set();
for (let i = 0; i < 25; i++) {
  const response = await runtime.request(new Request('http://localhost/api/orders', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{"product_id":1,"quantity":2,"email":"a@b.co"}' }));
  assert.equal(response.status, 201);
  ids.add((await response.json()).data.id);
}
assert.equal(ids.size, 25, 'random_bytes must draw fresh host entropy');
console.log('memory bytes:', runtime.memoryBytes, 'times:', runtime.times);
