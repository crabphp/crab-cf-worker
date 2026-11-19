import { readFile } from 'node:fs/promises';

// Node-only benchmark loader. Workers statically imports the same compiled module.
export async function load(url, context, next) {
  if (url.endsWith('.wasm') || url.endsWith('.zip')) {
    const bytes = await readFile(new URL(url));
    return { format: 'module', shortCircuit: true,
      source: `const b = Uint8Array.from(Buffer.from('${bytes.toString('base64')}', 'base64')); export default ${url.endsWith('.wasm') ? 'new WebAssembly.Module(b)' : 'b'};` };
  }
  if (url.endsWith('/php8.4-cloudflare-runtime.mjs')) {
    // Only the legacy package's environment guard; no PHP/runtime behavior changes.
    const source = (await readFile(new URL(url), 'utf8')).replaceAll('typeof process', 'typeof __not_node').replaceAll('globalThis.process', 'globalThis.__not_node');
    return { format: 'module', shortCircuit: true, source: 'globalThis.WorkerGlobalScope = class {};\n' + source };
  }
  return next(url, context);
}
