import assert from 'node:assert/strict';

export const cases = [
  ['GET', '/', 200, null, body => assert.match(body, /Hermit Mug/)],
  ['GET', '/products/3', 200, null, body => assert.match(body, /Coconut Backpack/)],
  ['GET', '/products/9', 404, null, body => assert.match(body, /not found|no such|missing/i)],
  ['GET', '/api/products', 200, null, body => assert.equal(JSON.parse(body).data.length, 5)],
  ['GET', '/api/products/2', 200, null, body => assert.match(body, /Fiddler Notebook/)],
  ['GET', '/api/products/9', 404],
  ['POST', '/api/orders', 201, { product_id: 1, quantity: 2, email: 'a@b.co' }, body => {
    const order = JSON.parse(body).data;
    assert.equal(order.total, '$36.00');
    assert.match(order.id, /^ord_[a-f0-9]{12}$/);
  }],
  ['POST', '/api/orders', 422, { product_id: 1, quantity: 99, email: 'bad' }, body => {
    assert.match(body, /quantity/); assert.match(body, /email/);
  }],
  ['POST', '/api/orders', 409, { product_id: 4, quantity: 1, email: 'a@b.co' }],
  ['GET', '/up', 200],
];

export async function acceptance(fetcher) {
  for (const [method, path, status, data, check] of cases) {
    const response = await fetcher(new Request(`http://localhost${path}`, {
      method, ...(data && { body: JSON.stringify(data), headers: { 'content-type': 'application/json' } }),
    }));
    const body = await response.text();
    assert.equal(response.status, status, `${method} ${path}: ${body}`);
    if (path.startsWith('/api/') && status !== 422) assert.match(response.headers.get('content-type'), /application\/json/);
    check?.(body);
    console.log(`PASS ${method} ${path}: ${status}`);
  }
}
