import { verifyAuth } from '../../lib/auth';
import { preflightResponse, jsonResponse } from '../../lib/cors';
import { deleteDoc, listCollection } from '../../lib/firestoreRest';

/**
 * Danger-zone account operations. This deletes the user's StockPilot data
 * (stores, AI usage) - it does NOT delete the underlying Firebase Auth
 * login record. Deleting the Auth record itself requires a separate,
 * carefully-tested admin call and isn't wired up yet; for now the user signs
 * out client-side after this completes.
 */
export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return preflightResponse();
  }

  const auth = await verifyAuth(request);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const action = url.pathname.split('/').filter(Boolean).pop();

  try {
    if (action === 'delete-data' && request.method === 'POST') {
      return await handleDeleteData(auth.uid);
    }
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('Account endpoint error:', { action, message: (error as Error).message });
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

async function deleteAllDocs(collectionPath: string): Promise<number> {
  const { docs } = await listCollection(collectionPath);
  await Promise.all(docs.map(doc => deleteDoc(`${collectionPath}/${doc.id}`)));
  return docs.length;
}

async function handleDeleteData(uid: string): Promise<Response> {
  const [storesDeleted, aiUsageDeleted] = await Promise.all([
    deleteAllDocs(`users/${uid}/stores`),
    deleteAllDocs(`users/${uid}/aiUsage`),
  ]);

  return jsonResponse({ deleted: { stores: storesDeleted, aiUsage: aiUsageDeleted } });
}
