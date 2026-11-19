export async function measure(create, path, clock = () => performance.now()) {
  const runtime = await create(clock);
  const times = { ...runtime.times };
  for (let i = 1; i <= 10; i++) {
    const start = clock();
    const response = await runtime.request(new Request(`http://localhost${path}`));
    const body = await response.text();
    if (response.status !== 200 || !body.includes(path === '/' ? 'Hermit Mug' : 'Fiddler Notebook')) {
      throw new Error(`${path}: ${response.status}: ${body}`);
    }
    if (i === 1 || i === 10) times[`request${i}`] = clock() - start;
  }
  times.cold = times.phpBoot + times.appBoot + times.request1;
  times.total = times.instantiate + times.cold;
  return { path, ...times, memoryBytes: runtime.memoryBytes };
}
