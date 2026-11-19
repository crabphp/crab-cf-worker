// Generate the file cache using the target wasm64 PHP, never host PHP opcodes.
import { mkdir, writeFile } from 'node:fs/promises';
import { create } from './new.mjs';
import { acceptance } from './acceptance.mjs';
const runtime = await create();
await acceptance(request => runtime.request(request));
runtime.evaluate('echo json_encode(opcache_get_status(false)), "\\n";');
let files = 0, bytes = 0;
async function copy(path) {
  for (const name of runtime.php.FS.readdir(path).filter(n => n !== '.' && n !== '..')) {
    const file = `${path}/${name}`;
    if (runtime.php.FS.isDir(runtime.php.FS.stat(file).mode)) await copy(file);
    else if (name.endsWith('.bin')) {
      const output = `runtime/.build/app${file.slice(4)}`;
      await mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true });
      const data = runtime.php.FS.readFile(file); await writeFile(output, data);
      files++; bytes += data.length;
    }
  }
}
await copy('/app/opcache');
if (!files) throw new Error('OPcache did not generate any files');
console.log({ files, bytes });
