import { getGoogleAccessToken } from './googleAuth';

/**
 * Minimal Firestore REST API client (https://firestore.googleapis.com/v1/...).
 * Replaces firebase-admin/firestore, which doesn't work in the Cloudflare
 * Workers runtime (see googleAuth.ts). Deliberately small: only the
 * operations this backend actually needs (get/set/delete a doc by path,
 * query a collection with a single equality filter + limit).
 */

type FirestoreValue = Record<string, unknown>;

function getProjectId(): string {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing VITE_FIREBASE_PROJECT_ID environment variable.');
  return projectId;
}

function baseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents`;
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  throw new Error(`Cannot encode value of type ${typeof value} for Firestore`);
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    fields[key] = encodeValue(value);
  }
  return fields;
}

function decodeValue(value: any): unknown {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields: Record<string, any>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    obj[key] = decodeValue(value);
  }
  return obj;
}

async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export interface FirestoreDoc {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
}

export async function getDoc(path: string): Promise<FirestoreDoc> {
  const response = await authorizedFetch(`${baseUrl()}/${path}`);
  const id = path.split('/').pop()!;

  if (response.status === 404) {
    return { exists: false, id, data: () => undefined };
  }
  if (!response.ok) {
    throw new Error(`Firestore getDoc(${path}) failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { fields?: Record<string, any> };
  const data = decodeFields(body.fields || {});
  return { exists: true, id, data: () => data };
}

export async function setDoc(
  path: string,
  data: Record<string, unknown>,
  options: { merge?: boolean } = {}
): Promise<void> {
  const fields = encodeFields(data);
  let url = `${baseUrl()}/${path}`;

  if (options.merge) {
    const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    url += `?${mask}`;
  }

  const response = await authorizedFetch(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Firestore setDoc(${path}) failed: ${response.status} ${await response.text()}`);
  }
}

export async function deleteDoc(path: string): Promise<void> {
  const response = await authorizedFetch(`${baseUrl()}/${path}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Firestore deleteDoc(${path}) failed: ${response.status} ${await response.text()}`);
  }
}

export interface QueryResult {
  empty: boolean;
  docs: FirestoreDoc[];
}

async function runStructuredQuery(collectionPath: string, structuredQuery: Record<string, unknown>): Promise<QueryResult> {
  const segments = collectionPath.split('/');
  const parentPath = segments.slice(0, -1).join('/');
  const parentUrl = parentPath ? `${baseUrl()}/${parentPath}` : baseUrl();

  const response = await authorizedFetch(`${parentUrl}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  });

  if (!response.ok) {
    throw new Error(`Firestore query(${collectionPath}) failed: ${response.status} ${await response.text()}`);
  }

  const results = (await response.json()) as Array<{ document?: { name: string; fields?: Record<string, any> } }>;
  const docs: FirestoreDoc[] = results
    .filter(r => r.document)
    .map(r => {
      const name = r.document!.name;
      const id = name.split('/').pop()!;
      const data = decodeFields(r.document!.fields || {});
      return { exists: true, id, data: () => data };
    });

  return { empty: docs.length === 0, docs };
}

/**
 * Queries a collection with a single equality filter, e.g. the
 * `.where('isActive', '==', true).limit(1)` pattern used to find a user's
 * active Shopify store.
 */
export async function queryCollection(
  collectionPath: string,
  where: { field: string; value: unknown },
  limit?: number
): Promise<QueryResult> {
  const collectionId = collectionPath.split('/').pop()!;

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    where: {
      fieldFilter: {
        field: { fieldPath: where.field },
        op: 'EQUAL',
        value: encodeValue(where.value),
      },
    },
  };
  if (limit) structuredQuery.limit = limit;

  return runStructuredQuery(collectionPath, structuredQuery);
}

/**
 * Lists every document in a collection with no filter, e.g. counting how
 * many stores a user has connected regardless of active/inactive state.
 */
export async function listCollection(collectionPath: string): Promise<QueryResult> {
  const collectionId = collectionPath.split('/').pop()!;
  return runStructuredQuery(collectionPath, { from: [{ collectionId }] });
}
