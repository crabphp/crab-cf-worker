import { create } from '../runtime/new.mjs';

// Restore PHP while the Worker's module loads, not in the first request: Cloudflare budgets that start-up
// apart from each request's CPU time (10 ms on the free plan), so a new isolate's first request stays cheap.
// If it fails here, the first request tries again.
let php = await create().catch(error => {
  console.error(error);
  return null;
});
let turn = Promise.resolve();

export default {
  fetch(request) {
    // PHP owns mutable application state: serialize boot, body reads, and calls.
    const answer = turn.then(async () => {
      try {
        php ??= await create();
        return await php.request(request);
      } catch (error) {
        // Do not reuse an interpreter after a bailout or host failure.
        php = null;
        console.error(error);
        return new Response('The application failed.\n', { status: 500 });
      }
    });
    turn = answer.catch(() => {});
    return answer;
  },
};
