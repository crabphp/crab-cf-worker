// Our embed ABI. Generated Emscripten code only supplies libc and MEMFS.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_REQUEST = 8 * 1024 * 1024;

export function bridge(php, times = {}) {
  function evaluate(code) {
    const bytes = encoder.encode(code + '\0');
    const pointer = php._malloc(BigInt(bytes.length));
    if (!pointer) throw new Error('PHP allocation failed');
    try {
      php.HEAPU8.set(bytes, Number(pointer));
      if (php._crab_eval(BigInt(pointer))) throw new Error('PHP evaluation failed');
    } finally { php._free(pointer); }
  }
  return { php, times, evaluate,
    get memoryBytes() { return php.HEAPU8.byteLength; },
    async request(request) {
      const url = new URL(request.url);
      const headers = [...request.headers];
      const chunks = [encoder.encode(request.method), encoder.encode(url.pathname + url.search), headers.length];
      for (const [name, value] of headers) chunks.push(encoder.encode(name), encoder.encode(value));
      chunks.push(new Uint8Array(await request.arrayBuffer()));
      const size = chunks.reduce((sum, chunk) => sum + 4 + (typeof chunk === 'number' ? 0 : chunk.length), 0);
      if (size > MAX_REQUEST) return new Response('Request too large.\n', { status: 413 });
      const pointer = php._malloc(BigInt(size));
      if (!pointer) throw new Error('PHP allocation failed');
      try {
        let offset = Number(pointer);
        const heap = php.HEAPU8;
        const view = new DataView(heap.buffer);
        for (const chunk of chunks) {
          view.setUint32(offset, typeof chunk === 'number' ? chunk : chunk.length, true); offset += 4;
          if (typeof chunk !== 'number') { heap.set(chunk, offset); offset += chunk.length; }
        }
        if (php._crab_request(BigInt(pointer), BigInt(size))) throw new Error('PHP request failed');
        // PHP allocations can grow memory, invalidating the previous heap view.
        const bytes = php.HEAPU8.slice(Number(php._crab_response()), Number(php._crab_response()) + Number(php._crab_response_size()));
        const answer = new DataView(bytes.buffer);
        offset = 0;
        const number = () => {
          if (offset + 4 > bytes.length) throw new Error('Truncated PHP response');
          const n = answer.getUint32(offset, true); offset += 4; return n;
        };
        const string = () => {
          const n = number();
          if (offset + n > bytes.length) throw new Error('Truncated PHP response');
          const value = bytes.subarray(offset, offset + n); offset += n; return value;
        };
        const status = number(), count = number(), responseHeaders = new Headers();
        for (let i = 0; i < count; i++) responseHeaders.append(decoder.decode(string()), decoder.decode(string()));
        const body = string();
        if (offset !== bytes.length) throw new Error('Trailing PHP response bytes');
        return new Response(request.method === 'HEAD' || [101, 204, 205, 304].includes(status) ? null : body, { status, headers: responseHeaders });
      } finally { php._free(pointer); }
    },
  };
}
