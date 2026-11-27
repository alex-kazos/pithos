// @vitest-environment node
/**
 * End-to-end through the real Hono app and a real Postgres: sign-up via
 * Better Auth, session cookies, migrations, encryption at rest, per-user
 * isolation and account deletion. Only outbound calls to Shopify/OpenAI are
 * stubbed.
 *
 * Runs when TEST_DATABASE_URL points at a disposable database (CI sets it;
 * locally: `npm run db:up`, create a pithos_test database, then set it).
 * Every table in that database is dropped first.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Hono } from 'hono';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('server against a real Postgres', () => {
  let app: Hono;
  let query: typeof import('./lib/db').query;
  let closePool: typeof import('./lib/db').closePool;
  const realFetch = globalThis.fetch;
  const outbound = vi.fn();

  const TOKEN = `shpat_${'c'.repeat(32)}`;
  const OPENAI_KEY = 'sk-integration-test-key-0123456789';

  async function signUp(email: string): Promise<string> {
    const response = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'Test User' }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    expect(cookie).toContain('session_token');
    return cookie;
  }

  function call(cookie: string, path: string, init: RequestInit = {}) {
    return app.request(path, { ...init, headers: { cookie, 'content-type': 'application/json', ...init.headers } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    const db = await import('./lib/db');
    query = db.query;
    closePool = db.closePool;
    await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    const { runMigrations } = await import('./lib/migrations');
    await runMigrations();
    await runMigrations(); // idempotent

    app = (await import('./app')).createApp();

    // Pass in-process requests through; stub everything that leaves the box.
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith('http://localhost')) return realFetch(input, init);
      return outbound(url, init);
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await closePool?.();
  });

  it('keeps each user in their own data, encrypts secrets at rest, and deletes everything with the account', async () => {
    const alice = await signUp('alice@example.com');
    const bob = await signUp('bob@example.com');

    // Unauthenticated calls are refused.
    expect((await app.request('/api/stores')).status).toBe(401);

    // Alice connects a Shopify store with a pasted token (verified against the shop first).
    outbound.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const connect = await call(alice, '/api/stores', {
      method: 'POST',
      body: JSON.stringify({ platform: 'shopify', shop: 'alice-shop', apiToken: TOKEN }),
    });
    expect(connect.status).toBe(201);

    const { stores } = await (await call(alice, '/api/stores')).json();
    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({ id: 'alice-shop', platform: 'shopify', url: 'alice-shop.myshopify.com', isActive: true });
    expect(JSON.stringify(stores)).not.toContain(TOKEN);

    const stored = await query<{ credentials_encrypted: string }>('SELECT credentials_encrypted FROM stores');
    expect(stored.rows[0].credentials_encrypted).not.toContain(TOKEN);

    // Bob can neither list nor proxy through Alice's store.
    expect((await (await call(bob, '/api/stores')).json()).stores).toEqual([]);
    expect((await call(bob, '/api/shopify/admin/api/2024-04/products', { headers: { 'x-store-id': 'alice-shop' } })).status).toBe(404);

    // Alice's proxy calls use her decrypted token.
    outbound.mockResolvedValueOnce(new Response(JSON.stringify({ products: [] }), { status: 200 }));
    const proxied = await call(alice, '/api/shopify/admin/api/2024-04/products', { headers: { 'x-store-id': 'alice-shop' } });
    expect(proxied.status).toBe(200);
    expect(outbound.mock.lastCall?.[1]?.headers['X-Shopify-Access-Token']).toBe(TOKEN);

    // AI features need Alice's own key; once saved, it's used for her requests only.
    const noKey = await call(alice, '/api/openai/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
    expect((await noKey.json()).code).toBe('openai_key_missing');

    outbound.mockResolvedValueOnce(new Response('{"data":[]}', { status: 200 })); // GET /models check
    const saved = await (await call(alice, '/api/settings/openai-key', { method: 'PUT', body: JSON.stringify({ apiKey: OPENAI_KEY }) })).json();
    expect(saved).toEqual({ configured: true, hint: '…6789' });
    const keyRow = await query<{ openai_key_encrypted: string }>('SELECT openai_key_encrypted FROM user_settings');
    expect(keyRow.rows[0].openai_key_encrypted).not.toContain(OPENAI_KEY);

    outbound.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }), { status: 200 })
    );
    const chat = await call(alice, '/api/openai/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
    expect(chat.status).toBe(200);
    expect(outbound.mock.lastCall?.[1]?.headers.Authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect((await (await call(bob, '/api/settings/openai-key')).json()).configured).toBe(false);

    // Preferences merge rather than replace.
    await call(alice, '/api/settings/preferences', { method: 'PUT', body: JSON.stringify({ theme: 'light' }) });
    await call(alice, '/api/settings/preferences', { method: 'PUT', body: JSON.stringify({ language: 'el' }) });
    expect((await (await call(alice, '/api/settings/preferences')).json()).preferences).toEqual({ theme: 'light', language: 'el' });

    // Deleting the account removes the login and everything hanging off it.
    expect((await call(alice, '/api/account/delete', { method: 'POST' })).status).toBe(200);
    expect((await call(alice, '/api/stores')).status).toBe(401);
    const leftovers = await query<{ users: string; stores: string; settings: string; sessions: string }>(`
      SELECT (SELECT count(*) FROM "user" WHERE email = 'alice@example.com') AS users,
             (SELECT count(*) FROM stores) AS stores,
             (SELECT count(*) FROM user_settings WHERE openai_key_encrypted IS NOT NULL) AS settings,
             (SELECT count(*) FROM "session") AS sessions`);
    expect(leftovers.rows[0]).toEqual({ users: '0', stores: '0', settings: '0', sessions: '1' }); // Bob's session remains
  });

  it("reads products and orders from the user's own Postgres, read-only, without ever returning its password", async () => {
    // The merchant's "own database" is this same test server - so it's a
    // private host, which a deployment has to opt in to.
    process.env.ALLOW_PRIVATE_DATABASE_HOSTS = 'true';
    await query(`
      CREATE TABLE byo_products (code TEXT PRIMARY KEY, name TEXT, qty INT, price NUMERIC(10,2));
      CREATE TABLE byo_order_lines (order_ref TEXT, ordered_at TIMESTAMPTZ, product_code TEXT, qty INT, unit_price NUMERIC(10,2));
      INSERT INTO byo_products VALUES ('MUG', 'Mug', 12, 9.50), ('TEE', 'T-shirt', 0, 20.00);
      INSERT INTO byo_order_lines VALUES
        ('A-1', now() - interval '2 days', 'MUG', 2, 9.50),
        ('A-1', now() - interval '2 days', 'TEE', 1, 20.00),
        ('A-2', now() - interval '1 day', 'MUG', 1, 9.50);
    `);

    const source = new URL(TEST_DATABASE_URL!);
    source.searchParams.set('sslmode', 'disable');
    const carol = await signUp('carol@example.com');

    const badQuery = await call(carol, '/api/stores', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'database',
        connectionString: source.toString(),
        productsQuery: 'SELECT code AS id, name FROM byo_products',
        ordersQuery: 'SELECT 1',
      }),
    });
    expect(badQuery.status).toBe(400);
    expect((await badQuery.json()).error).toMatch(/missing columns "title", "inventory_quantity"/);

    const connect = await call(carol, '/api/stores', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'database',
        name: 'Warehouse DB',
        connectionString: source.toString(),
        productsQuery: 'SELECT code AS id, name AS title, code AS sku, qty AS inventory_quantity, price FROM byo_products;',
        ordersQuery:
          'SELECT order_ref AS order_id, ordered_at AS created_at, product_code AS product_id, qty AS quantity, unit_price AS price FROM byo_order_lines',
      }),
    });
    expect(connect.status).toBe(201);
    const { store } = await connect.json();
    expect(store).toMatchObject({ platform: 'database', label: 'Warehouse DB', isActive: true });

    const password = decodeURIComponent(source.password);
    const listed = await (await call(carol, '/api/stores')).text();
    expect(listed).not.toContain(password);
    const config = await (await call(carol, '/api/database/config', { headers: { 'x-store-id': store.id } })).json();
    expect(config.config).toMatchObject({ user: decodeURIComponent(source.username) });
    expect(JSON.stringify(config)).not.toContain(password);

    const products = await (await call(carol, '/api/database/products', { headers: { 'x-store-id': store.id } })).json();
    expect(products).toHaveLength(2);
    expect(products.find((p: { title: string }) => p.title === 'Mug').variants[0]).toMatchObject({ sku: 'MUG', inventory_quantity: 12, price: '9.5' });

    const orders = await (await call(carol, '/api/database/orders', { headers: { 'x-store-id': store.id } })).json();
    expect(orders).toHaveLength(2);
    const a1 = orders.find((o: { line_items: unknown[] }) => o.line_items.length === 2);
    expect(a1.total_price).toBe('39');
    // String product codes become the same numeric id on both sides, so sales line up with products.
    const mugId = products.find((p: { title: string }) => p.title === 'Mug').id;
    expect(a1.line_items.map((li: { product_id: number }) => li.product_id)).toContain(mugId);

    // Another user can't read through Carol's connection.
    const dave = await signUp('dave@example.com');
    expect((await call(dave, '/api/database/products', { headers: { 'x-store-id': store.id } })).status).toBe(404);

    delete process.env.ALLOW_PRIVATE_DATABASE_HOSTS;
  });
});
