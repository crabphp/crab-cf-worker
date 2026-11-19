import factory from './dist/php.mjs';
import wasmModule from './dist/php.wasm';
import { instantiate } from './instantiate.mjs';
import startup from './dist/startup.mjs';

export const create = clock => instantiate(factory, wasmModule, clock, startup);
