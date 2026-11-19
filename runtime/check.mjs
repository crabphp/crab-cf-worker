import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { create } from './new.mjs';
import { acceptance } from './acceptance.mjs';

const runtime = await create();
await acceptance(request => runtime.request(request));
runtime.evaluate(`
if (PHP_INT_SIZE !== 8 || PHP_INT_MAX !== 9223372036854775807) throw new Exception('Not 64-bit');
if ((new ReflectionClassConstant(Crab\\Validation\\Validator::class, 'SAFE'))->getValue() !== 9007199254740991) throw new Exception('Patched Validator');
if (!extension_loaded('mbstring') || mb_strlen('🦀é', 'UTF-8') !== 2) throw new Exception('Native mbstring failed');
foreach (['zip', 'vrzno', 'PDO', 'session', 'curl', 'sockets'] as $extension) {
    if (extension_loaded($extension)) throw new Exception('Unexpected extension: ' . $extension);
}
file_put_contents('/tmp/runtime-info.json', json_encode(['php' => PHP_VERSION, 'intSize' => PHP_INT_SIZE, 'extensions' => get_loaded_extensions(), 'phpMemory' => memory_get_peak_usage(true), 'files' => get_included_files()], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
`);
await writeFile('runtime/.build/runtime-info.json', runtime.php.FS.readFile('/tmp/runtime-info.json'));
const ids = new Set(), randomSequences = new Set();
for (const instance of [runtime, await create(), await create()]) {
  instance.evaluate('file_put_contents("/tmp/live.json", json_encode([time(), mt_rand(), mt_rand(), mt_rand(), @lcg_value()]));');
  const [timestamp, ...random] = JSON.parse(new TextDecoder().decode(instance.php.FS.readFile('/tmp/live.json')));
  assert.ok(Math.abs(timestamp - Date.now() / 1000) < 5, 'snapshot must not freeze time');
  randomSequences.add(JSON.stringify(random));
  for (let i = 0; i < 25; i++) {
    const response = await instance.request(new Request('http://localhost/api/orders', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: '{"product_id":1,"quantity":2,"email":"a@b.co"}' }));
    assert.equal(response.status, 201);
    ids.add((await response.json()).data.id);
  }
}
assert.equal(randomSequences.size, 3, 'snapshot PRNGs must be independently seeded');
assert.equal(ids.size, 75, 'random_bytes must draw fresh host entropy across instances');
// Zend huge allocations need aligned addresses, not size rounded to alignment.
// Exercise a non-2-MiB-multiple allocation and the near-limit request path.
runtime.evaluate('$large = str_repeat("x", 3 * 1024 * 1024 + 17); if (strlen($large) !== 3145745) throw new Exception("Huge allocation failed"); unset($large);');
const large = await runtime.request(new Request('http://localhost/api/orders', { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: 1, quantity: 2, email: 'x'.repeat(7 * 1024 * 1024) }) }));
assert.equal(large.status, 422);
await large.arrayBuffer();
assert.equal((await runtime.request(new Request('http://localhost/up'))).status, 200);
console.log('PASS 64-bit bounds, native mbstring, extension set, live time, independent randomness and large allocations');
console.log('memory bytes:', runtime.memoryBytes, 'times:', runtime.times);
