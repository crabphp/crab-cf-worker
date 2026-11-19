import { create } from '../runtime/new.mjs';

let php = null;
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
