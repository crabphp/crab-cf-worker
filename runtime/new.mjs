import factory from './dist/php.mjs';
import wasmModule from './dist/php.wasm';
import { bridge } from './bridge.mjs';

export async function create(clock = () => performance.now()) {
  const start = clock();
  const php = await factory({ instantiateWasm(imports, receive) {
    const instance = new WebAssembly.Instance(wasmModule, imports);
    receive(instance, wasmModule);
    return instance.exports;
  }, print: text => console.log(text), printErr: text => console.error(text) });
  const instantiate = clock() - start;
  const boot = clock();
  if (php._crab_init()) throw new Error('PHP init failed');
  const phpBoot = clock() - boot;
  const app = clock();
  if (php._crab_boot()) throw new Error('PHP boot failed');
  return bridge(php, { instantiate, phpBoot, appBoot: clock() - app });
}
