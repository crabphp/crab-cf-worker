import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';

const roots = ['app', 'app.php', 'config', 'resources', 'routes', 'worker.php', 'composer.json', 'composer.lock',
  'runtime/Dockerfile', 'runtime/build.sh', 'runtime/patch-php.py', 'runtime/embed.c', 'runtime/platform.c',
  'runtime/php.ini', 'runtime/opcache.c', 'runtime/opcache.ini', 'runtime/compact.php', 'runtime/trace.mjs',
  'runtime/prune.mjs', 'runtime/snapshot.mjs', 'runtime/acceptance.mjs', 'runtime/licenses.py',
  'runtime/bridge.mjs', 'runtime/instantiate.mjs', 'runtime/new.mjs', 'runtime/node-loader.mjs',
  'runtime/cache-opcodes.mjs', 'runtime/check.mjs', 'runtime/manifest.mjs'];
async function hashFiles(paths) {
  const hashes = {};
  async function visit(path) {
    if ((await stat(path)).isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(`${path}/${name}`);
    } else hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  for (const path of paths) await visit(path);
  return hashes;
}
const inputs = await hashFiles(roots);
const artifacts = await hashFiles(['runtime/dist/php.wasm', 'runtime/dist/php.mjs', 'runtime/dist/startup.mjs', 'runtime/dist/licenses']);
if (process.argv[2] === '--check') {
  const expected = JSON.parse(await readFile('runtime/dist/manifest.json', 'utf8'));
  if (JSON.stringify(inputs) !== JSON.stringify(expected.inputs) || JSON.stringify(artifacts) !== JSON.stringify(expected.artifacts)) {
    throw new Error('Runtime artifacts are missing, changed, or stale. Run npm run runtime:build and commit runtime/dist/.');
  }
} else {
  await writeFile('runtime/dist/manifest.json', JSON.stringify({ mode: process.argv[2], php: '8.4.27', emscripten: '4.0.20', memory64: true, inputs, artifacts }, null, 2) + '\n');
}
