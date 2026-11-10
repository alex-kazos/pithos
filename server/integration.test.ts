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
});
