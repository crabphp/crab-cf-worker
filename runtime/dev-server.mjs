import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';

// Each caller owns a Wrangler process and always closes it in finally.
export async function devServer(config, port = 8791, inspectorPort = 9237) {
  let log = '';
  const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev',
    '--config', config, '--port', String(port), '--inspector-port', String(inspectorPort), '--ip', '127.0.0.1', '--show-interactive-dev-session=false'],
  { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { log += b; });
  child.stderr.on('data', b => { log += b; });
  const close = async () => {
    if (child.exitCode !== null || child.signalCode) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timer = globalThis.setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await exited; } finally { clearTimeout(timer); }
  };
  try {
    for (let i = 0; i < 600; i++) {
      if (child.exitCode !== null || child.signalCode) throw new Error(log);
      if (log.includes('Ready on')) return { url: `http://127.0.0.1:${port}`, close, log: () => log };
      await setTimeout(100);
    }
    throw new Error(`Wrangler did not start:\n${log}`);
  } catch (error) { await close(); throw error; }
}
