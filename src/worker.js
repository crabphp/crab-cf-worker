import { create } from '../runtime/new.mjs';

// Restore PHP while the Worker's module loads, not in the first request: Cloudflare budgets that start-up
// apart from each request's CPU time, so a new isolate's first request stays cheap.
// If it fails here, the first request tries again.
let php = await create().catch(error => {
  console.error(error);
  return null;
});

export default {
  // No queue between requests. php.request() reads the body, the only await, before it calls PHP, and the
  // call into PHP is synchronous, so two requests are never inside PHP at once. A queue would also make
  // each request wait on a promise of the one before, which Cloudflare cancels as hung when that request goes.
  async fetch(request) {
    try {
      php ??= await create();
      return await php.request(request);
    } catch (error) {
      // Do not reuse an interpreter after a bailout or host failure.
      php = null;
      console.error(error);
      return new Response('The application failed.\n', { status: 500 });
    }
  },
};
