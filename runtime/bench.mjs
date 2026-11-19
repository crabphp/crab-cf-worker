import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { devServer } from './dev-server.mjs';

const kind = process.argv[2] ?? 'new';
const engine = process.argv[3] ?? 'node';
const runs = Number(process.env.RUNS ?? 5);
if (!['old', 'new'].includes(kind) || !['node', 'workerd'].includes(engine)) throw new Error('Usage: node runtime/bench.mjs old|new node|workerd');
await mkdir('runtime/results', { recursive: true });
await mkdir('runtime/.cache', { recursive: true });
const importLine = kind === 'old' ? "import { legacy as create } from '../legacy.mjs';" : "import { create } from '../new.mjs';";
const rows = [];
if (engine === 'node') {
  await writeFile('runtime/.cache/bench-node.mjs', `${importLine}\nimport { measure } from '../bench-case.mjs';\nconsole.log(JSON.stringify(await measure(create, process.argv[2])));\n`);
  for (const path of ['/', '/api/products']) for (let run = 0; run < runs; run++) {
    const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './runtime/node-loader.mjs', 'runtime/.cache/bench-node.mjs', path], { encoding: 'utf8' });
    if (result.status) throw new Error(result.stderr + result.stdout);
    const row = JSON.parse(result.stdout.trim().split('\n').at(-1));
    rows.push(row); console.log(row);
  }
} else {
  // Local workerd's clock advances; never use these timers on live Workers.
  // Old runtime needs the old compatibility date.
  await writeFile('runtime/.cache/bench-worker.mjs', `${importLine}\nimport { measure } from '../bench-case.mjs';\nexport default { async fetch(request) { return Response.json(await measure(create, new URL(request.url).pathname, () => performance.now())); } };\n`);
  await writeFile('runtime/.cache/bench.toml', `name = "crab-runtime-bench"\nmain = "bench-worker.mjs"\ncompatibility_date = "${kind === 'old' ? '2025-05-05' : '2026-11-19'}"\n[[rules]]\ntype = "Data"\nglobs = ["**/*.zip"]\nfallthrough = true\n`);
  const server = await devServer('runtime/.cache/bench.toml', 8792);
  try {
    for (const path of ['/', '/api/products']) for (let run = 0; run < runs; run++) {
      const response = await fetch(server.url + path);
      if (!response.ok) throw new Error(await response.text() + server.log());
      const row = await response.json(); rows.push(row); console.log(row);
    }
  } finally { await server.close(); }
}
const medians = ['/', '/api/products'].map(path => {
  const matching = rows.filter(row => row.path === path);
  return Object.fromEntries(Object.keys(matching[0]).map(key => [key, key === 'path' ? path : matching.map(row => row[key]).sort((a,b) => a-b)[Math.floor(runs / 2)]]));
});
const result = { kind, engine, node: process.version, runs, date: new Date().toISOString(), medians, rows };
await writeFile(`runtime/results/${kind}-${engine}.json`, JSON.stringify(result, null, 2) + '\n');
console.table(medians);
