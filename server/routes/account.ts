import { verifyAuth } from '../lib/auth';
import { jsonResponse } from '../lib/http';
import { withTransaction } from '../lib/db';

/**
 * Danger-zone account operations. Deleting the account removes the login
 * itself plus everything that belongs to it: every table StockPilot owns
 * references "user" with ON DELETE CASCADE (see lib/migrations.ts).
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  const auth = await verifyAuth(request);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const action = url.pathname.split('/').filter(Boolean).pop();

  try {
    if (action === 'delete' && request.method === 'POST') {
      return await handleDelete(auth.uid);
    }
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('Account endpoint error:', { action, message: (error as Error).message });
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function handleDelete(uid: string): Promise<Response> {
  await withTransaction(async client => {
    // Better Auth's own tables, explicitly - not relying on how its
    // migrations happened to declare their foreign keys.
    await client.query('DELETE FROM "session" WHERE "userId" = $1', [uid]);
    await client.query('DELETE FROM "account" WHERE "userId" = $1', [uid]);
    await client.query('DELETE FROM "user" WHERE id = $1', [uid]);
  });

  return jsonResponse({ deleted: true });
}
