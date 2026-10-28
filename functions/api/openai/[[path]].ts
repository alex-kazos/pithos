import { verifyAuth } from '../../lib/auth';
import { preflightResponse, jsonResponse } from '../../lib/cors';
import { chatCompletion, isOpenAIConfigured } from '../../lib/openai';
import {
  checkAndConsumeChatQuota,
  getCachedRecommendations,
  getChatUsageStatus,
  saveRecommendations,
} from '../../lib/aiUsage';
import { sanitizeMessages } from '../../lib/promptSafety';

// Chatbot: high-volume, user-driven, simple lookups over already-filtered
// product data - optimized for speed. Recommendations: low-volume periodic
// refresh producing financial predictions a merchant might act on -
// optimized for reasoning quality over cost. Both are overridable per
// deployment, e.g. to use whatever models your own OpenAI key has access to.
const DEFAULT_CHAT_MODEL = 'gpt-5.6-luna';
const DEFAULT_RECOMMENDATIONS_MODEL = 'gpt-5.6-terra';

function chatModel(): string {
  return process.env.OPENAI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
}

function recommendationsModel(): string {
  return process.env.OPENAI_RECOMMENDATIONS_MODEL || DEFAULT_RECOMMENDATIONS_MODEL;
}

interface ChatMessage {
  role: string;
  content: string;
}

function isValidMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      m => m && typeof m === 'object' && typeof (m as any).role === 'string' && typeof (m as any).content === 'string'
    )
  );
}

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

  // Checked before any quota is consumed, so a deployment that skipped the
  // key gets a clear answer instead of burning chat quota on failed calls.
  if (request.method === 'POST' && !isOpenAIConfigured()) {
    return jsonResponse({ error: 'AI features are not configured on this server (OPENAI_API_KEY is not set).' }, 503);
  }

  try {
    if (action === 'chat' && request.method === 'POST') {
      return await handleChat(auth.uid, request);
    }
    if (action === 'recommendations' && request.method === 'GET') {
      return await handleGetRecommendations(auth.uid, url);
    }
    if (action === 'recommendations' && request.method === 'POST') {
      return await handleRecommendations(auth.uid, request);
    }
    if (action === 'usage' && request.method === 'GET') {
      const usage = await getChatUsageStatus(auth.uid);
      return jsonResponse({ usage });
    }
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('OpenAI proxy error:', { action, message: (error as Error).message });
    return jsonResponse({ error: (error as Error).message || 'Internal server error' }, 500);
  }
}

async function handleChat(uid: string, request: Request) {
  const body = await request.json().catch(() => ({}) as any);
  if (!isValidMessages(body.messages)) {
    return jsonResponse({ error: 'messages array is required' }, 400);
  }

  const quota = await checkAndConsumeChatQuota(uid);
  if (!quota.allowed) {
    return jsonResponse({ error: 'Monthly AI chat message limit reached', usage: quota }, 429);
  }

  // The messages array may embed untrusted text pulled from the connected
  // store (product names, order data) alongside the user's own message -
  // never forward it to OpenAI unsanitized, regardless of what the client
  // claims it already did on its end.
  const { messages, flaggedCount } = sanitizeMessages(body.messages);
  if (flaggedCount > 0) {
    console.warn('Potential prompt injection neutralized in chat request', { uid, flaggedCount });
  }

  const data = await chatCompletion({
    model: chatModel(),
    messages,
    max_completion_tokens: 1000,
  });

  return jsonResponse({ message: data.choices[0].message, usage: quota });
}

function isValidStoreKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length < 200;
}

async function handleGetRecommendations(uid: string, url: URL) {
  const storeKey = url.searchParams.get('storeKey');
  if (!isValidStoreKey(storeKey)) {
    return jsonResponse({ error: 'storeKey query param is required' }, 400);
  }

  const cached = await getCachedRecommendations(uid, storeKey);
  return jsonResponse({ cached });
}

async function handleRecommendations(uid: string, request: Request) {
  const body = await request.json().catch(() => ({}) as any);
  if (!isValidMessages(body.messages)) {
    return jsonResponse({ error: 'messages array is required' }, 400);
  }
  if (!isValidStoreKey(body.storeKey)) {
    return jsonResponse({ error: 'storeKey is required' }, 400);
  }

  // Product data embedded in this prompt comes from the connected store and
  // is untrusted, same reasoning as the chat path above.
  const { messages, flaggedCount } = sanitizeMessages(body.messages);
  if (flaggedCount > 0) {
    console.warn('Potential prompt injection neutralized in recommendations request', { uid, flaggedCount });
  }

  const data = await chatCompletion({
    model: recommendationsModel(),
    messages,
    max_completion_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(data.choices[0].message.content);
  const recommendations = sanitizeRecommendations(parsed?.recommendations);

  const saved = await saveRecommendations(uid, body.storeKey, recommendations);
  return jsonResponse({ cached: saved });
}

const MAX_RECOMMENDATIONS = 10;
const MAX_FIELD_LENGTH = 500;

/**
 * A successful injection could try to make the model emit an oversized or
 * malformed payload instead of well-formed recommendations. Validate shape
 * and cap field lengths / item count before this is ever persisted or shown.
 */
function sanitizeRecommendations(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];

  const clamp = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_FIELD_LENGTH) : '');

  return value.slice(0, MAX_RECOMMENDATIONS).map(item => ({
    message: clamp(item?.message),
    priority: clamp(item?.priority),
    type: clamp(item?.type),
    prediction: clamp(item?.prediction),
    product_type: clamp(item?.product_type),
    sku: clamp(item?.sku),
  }));
}
