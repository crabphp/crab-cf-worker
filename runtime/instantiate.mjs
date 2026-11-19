import { bridge } from './bridge.mjs';

export async function instantiate(factory, module, clock = () => performance.now(), snapshot = null) {
  const start = clock();
  const php = await factory({ instantiateWasm(imports, receive) {
    const instance = new WebAssembly.Instance(module, imports);
    if (snapshot) {
      const loadFiles = Object.values(imports).flatMap(Object.entries).find(([key]) => key.includes('load_embedded_files'))?.[1];
      if (!loadFiles) throw new Error('Missing embedded filesystem loader');
      // C constructors already ran at build time. Only recreate the JS-side
      // filesystem; do not reset libc/allocator state in the initialized heap.
      receive({ exports: { ...instance.exports, __wasm_call_ctors() {
        loadFiles(BigInt(snapshot.embeddedPointer));
      } } }, module);
    } else {
      receive(instance, module);
    }
    return instance.exports;
  }, print: text => console.log(text), printErr: text => console.error(text) });
  const instantiate = clock() - start;
  if (snapshot) return bridge(php, { instantiate, phpBoot: 0, appBoot: 0 });
  const boot = clock();
  if (php._crab_init()) throw new Error('PHP init failed');
  const phpBoot = clock() - boot;
  const app = clock();
  if (php._crab_boot()) throw new Error('PHP boot failed');
  return bridge(php, { instantiate, phpBoot, appBoot: clock() - app });
}
