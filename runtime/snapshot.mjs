// Wizer-style snapshot for this fixed Emscripten embedding. Run with Node 24+.
// No JS engine serialization: initialized linear memory and mutable Wasm globals
// become normal Wasm initializers. The deterministic MEMFS tree is recreated.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const input = process.argv[2] ?? 'runtime/dist/php';
const output = process.argv[3] ?? 'runtime/dist/snapshot';
// Build-time only: deterministic host inputs make the image reproducible.
// crab_prepare_snapshot closes the entropy fd and clears all seeded default
// PRNG state. A restored interpreter uses the real host clock and CSPRNG.
const RealDate = Date;
const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? 1792540800) * 1000;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [epoch])); }
  static now() { return epoch; }
};
Object.defineProperty(performance, 'now', { value: () => 0 });
globalThis.crypto.getRandomValues = bytes => bytes.fill(0x5a);
const factory = (await import(pathToFileURL(resolve(input + '.mjs')))).default;
const original = new Uint8Array(await readFile(input + '.wasm'));
const enc = new TextEncoder();
const cat = (...arrays) => Uint8Array.from(arrays.flatMap(a => Array.from(a)));
function uleb(value) {
  let n = BigInt(value), bytes = [];
  do { const byte = Number(n & 127n); n >>= 7n; bytes.push(byte | (n ? 128 : 0)); } while (n);
  return bytes;
}
function sleb(value) {
  let n = BigInt(value), bytes = [];
  while (true) {
    const byte = Number(n & 127n); n >>= 7n;
    const done = (n === 0n && !(byte & 64)) || (n === -1n && (byte & 64));
    bytes.push(byte | (done ? 0 : 128)); if (done) return bytes;
  }
}
function readU(bytes, cursor) {
  let n = 0, shift = 0, byte;
  do { byte = bytes[cursor.p++]; n += (byte & 127) * 2 ** shift; shift += 7; } while (byte & 128);
  return n;
}
const sections = [];
for (const cursor = { p: 8 }; cursor.p < original.length;) {
  const id = original[cursor.p++], size = readU(original, cursor);
  sections.push({ id, data: original.slice(cursor.p, cursor.p + size) }); cursor.p += size;
}
const globals = sections.find(s => s.id === 6).data;
const g = { p: 0 }, globalCount = readU(globals, g), globalTypes = [];
for (let i = 0; i < globalCount; i++) {
  const type = globals[g.p++], mutable = globals[g.p++], opcode = globals[g.p++];
  if (![0x7e, 0x7f].includes(type) || ![0x41, 0x42].includes(opcode)) throw new Error('Unsupported snapshot global');
  while (globals[g.p++] & 128) {}
  if (globals[g.p++] !== 0x0b) throw new Error('Unsupported global initializer');
  globalTypes.push({ type, mutable });
}
// Export globals in the temporary build-time module so their post-boot values
// can be captured. Production exports remain unchanged.
const exports = sections.find(s => s.id === 7).data, e = { p: 0 };
const count = readU(exports, e);
const added = globalTypes.map((_, index) => {
  const name = enc.encode(`snapshot_global_${index}`);
  return cat(uleb(name.length), name, [3], uleb(index));
});
const encode = list => Buffer.concat([Buffer.from(original.subarray(0, 8)), ...list.map(({ id, data }) => Buffer.concat([Buffer.from([id, ...uleb(data.length)]), Buffer.from(data)]))]);
const instrumented = encode(sections.map(s => s.id === 7 ? { id: 7, data: cat(uleb(count + globalCount), exports.subarray(e.p), ...added) } : s));
let instance, embeddedPointer;
const module = new WebAssembly.Module(instrumented);
if (WebAssembly.Module.imports(module).some(entry => entry.kind !== 'function')) {
  throw new Error('Snapshot requires module-owned memory, tables and globals');
}
const php = await factory({ instantiateWasm(imports, receive) {
  for (const namespace of Object.values(imports)) for (const key of Object.keys(namespace)) {
    if (key.includes('load_embedded_files')) {
      const original = namespace[key];
      namespace[key] = pointer => { embeddedPointer = pointer; return original(pointer); };
    }
  }
  instance = new WebAssembly.Instance(module, imports); receive(instance, module); return instance.exports;
}});
if (php._crab_init() || php._crab_boot()) throw new Error('Snapshot boot failed');
php._crab_prepare_snapshot();
if (embeddedPointer === undefined) throw new Error('Missing embedded filesystem');
const open = php.FS.streams.filter(stream => stream && stream.fd > 2);
if (open.length) throw new Error(`Snapshot has open host files: ${open.map(s => s.path)}`);
const capturedGlobals = cat(uleb(globalCount), ...globalTypes.map(({ type, mutable }, index) =>
  cat([type, mutable, type === 0x7e ? 0x42 : 0x41], sleb(instance.exports[`snapshot_global_${index}`].value), [0x0b])));
const heap = php.HEAPU8;
const memory = sections.find(s => s.id === 5).data, m = { p: 0 };
if (readU(memory, m) !== 1 || readU(memory, m) !== 5) throw new Error('Expected one bounded memory64 memory');
readU(memory, m); // Original minimum; boot may have grown it.
const maximumPages = readU(memory, m);
if (heap.length / 65536 > maximumPages || m.p !== memory.length) throw new Error('Invalid snapshot memory limits');
const capturedMemory = cat([1, 5], uleb(heap.length / 65536), uleb(maximumPages));
const segments = [];
for (let start = 0; start < heap.length; start += 65536) {
  const page = heap.subarray(start, start + 65536);
  let end = page.length;
  while (end && !page[end - 1]) end--;
  if (end) segments.push(Buffer.concat([Buffer.from([0, 0x42, ...sleb(start), 0x0b, ...uleb(end)]), Buffer.from(page.subarray(0, end))]));
}
const data = Buffer.concat([Buffer.from(uleb(segments.length)), ...segments]);
const bytes = encode(sections.map(section => {
  if (section.id === 5) return { id: 5, data: capturedMemory };
  if (section.id === 6) return { id: 6, data: capturedGlobals };
  if (section.id === 11) return { id: 11, data };
  if (section.id === 12) return { id: 12, data: Uint8Array.from(uleb(segments.length)) };
  return section;
}));
await writeFile(output + '.wasm', bytes);
await writeFile(output + '.json', JSON.stringify({ embeddedPointer: String(embeddedPointer), memoryBytes: heap.length, wasmBytes: bytes.length, segments: segments.length }, null, 2) + '\n');
console.log(`Snapshot: ${bytes.length} bytes, ${segments.length} memory segments, ${heap.length} bytes of linear memory.`);
