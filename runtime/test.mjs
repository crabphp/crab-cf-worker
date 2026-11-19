import { acceptance } from './acceptance.mjs';
import { devServer } from './dev-server.mjs';

const server = await devServer('wrangler.toml');
try {
  await acceptance(request => fetch(new Request(server.url + new URL(request.url).pathname, request)));
} catch (error) {
  console.error(server.log());
  throw error;
} finally {
  await server.close();
}
