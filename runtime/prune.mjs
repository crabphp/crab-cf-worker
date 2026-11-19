// Keep all application files, but only vendor files observed while executing
// acceptance + edge-case requests. This image is for this app, not arbitrary PHP.
import { readFile, readdir, unlink, rmdir } from 'node:fs/promises';
const trace = JSON.parse(await readFile('runtime/.build/trace.json', 'utf8'));
const needed = new Set(trace.included.map(path => path.replace(/^\/app\//, '')));
let removed = 0;
async function prune(path) {
  for (const entry of await readdir(`runtime/.build/app/${path}`, { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) {
      await prune(child);
      if (!(await readdir(`runtime/.build/app/${child}`)).length) await rmdir(`runtime/.build/app/${child}`);
    } else if (!needed.has(child)) {
      await unlink(`runtime/.build/app/${child}`); removed++;
    }
  }
}
await prune('vendor');
console.log(`Removed ${removed} unobserved vendor files; retained all app/config/routes/resources.`);
