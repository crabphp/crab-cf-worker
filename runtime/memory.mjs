// Local workerd isolate memory, via the DevTools inspector (not whole-process RSS).
import { mkdir, writeFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { devServer } from './dev-server.mjs';
import { acceptance } from './acceptance.mjs';
await mkdir('runtime/.cache', { recursive: true });
await writeFile('runtime/.cache/memory-worker.mjs', `import { create } from '../new.mjs';
let runtime, turn = Promise.resolve();
export default { fetch(request) {
  const answer = turn.then(async () => {
    runtime ??= await create();
    if (new URL(request.url).pathname === '/__memory') return Response.json({ linearBytes: runtime.memoryBytes });
    return runtime.request(request);
  });
  turn = answer.catch(() => {}); return answer;
}};\n`);
await writeFile('runtime/.cache/memory.toml', 'name = "crab-runtime-memory"\nmain = "memory-worker.mjs"\ncompatibility_date = "2026-11-19"\n');
const server = await devServer('runtime/.cache/memory.toml', 8793, 9238);
let socket;
try {
  await acceptance(request => fetch(new Request(server.url + new URL(request.url).pathname, request)));
  const targets = await (await fetch('http://127.0.0.1:9238/json/list')).json();
  socket = new WebSocket(targets[0].webSocketDebuggerUrl, { origin: 'http://localhost:9238' });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  let next = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (task) { pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result); }
  };
  const call = method => new Promise((resolve, reject) => {
    const id = ++next;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Inspector timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method }));
  });
  await call('Runtime.enable');
  const before = await call('Runtime.getHeapUsage');
  for (let i = 0; i < 1000; i++) {
    const response = await fetch(server.url + (i % 2 ? '/' : '/api/products'));
    if (response.status !== 200) throw new Error(`Stress request ${i}: ${response.status}`);
    await response.arrayBuffer();
  }
  const after = await call('Runtime.getHeapUsage');
  const wasmLinearBytes = (await (await fetch(server.url + '/__memory')).json()).linearBytes;
  const large = await fetch(server.url + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product_id: 1, quantity: 2, email: 'x'.repeat(7 * 1024 * 1024) }) });
  if (large.status !== 422) throw new Error(`Large-body check: ${large.status}: ${await large.text()}`);
  await large.arrayBuffer();
  const largeBody = { ...await call('Runtime.getHeapUsage'), linearBytes: (await (await fetch(server.url + '/__memory')).json()).linearBytes };
  const result = { requests: 1000, before, after, wasmLinearBytes, largeBody,
    accountedBytes: wasmLinearBytes + after.totalSize + after.embedderHeapUsedSize + after.backingStorageSize,
    largeBodyAccountedBytes: largeBody.linearBytes + largeBody.totalSize + largeBody.embedderHeapUsedSize + largeBody.backingStorageSize,
    note: 'Local workerd inspector, without forced GC. The inspector excludes Wasm linear memory; add the separately verified 32 MiB. Sum uses allocated JS heap capacity plus reported backing/embedder storage; compiled-code/platform overhead is not included. Not whole-process RSS or live isolate telemetry.' };
  console.log(result);
  await writeFile('runtime/results/memory.json', JSON.stringify(result, null, 2) + '\n');
} finally {
  socket?.close();
  await server.close();
}
