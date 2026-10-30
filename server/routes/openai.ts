import { verifyAuth } from '../lib/auth';
import { jsonResponse } from '../lib/http';
import { chatCompletion, InvalidOpenAIKeyError } from '../lib/openai';
import { getCachedRecommendations, saveRecommendations } from '../lib/recommendations';
import { getOpenAIKey } from '../lib/userSettings';
import { sanitizeMessages } from '../lib/promptSafety';

// Chatbot: high-volume, user-driven, simple lookups over already-filtered
// product data - optimized for speed. Recommendations: low-volume periodic
// refresh producing financial predictions a merchant might act on -
// optimized for reasoning quality over cost. Both are overridable per
// deployment, e.g. to use whatever models your users' keys have access to.
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

// Error codes the frontend turns into "add / replace your key in Settings".
const KEY_MISSING = {
  error: 'Add your OpenAI API key in Settings → AI to use AI features.',
  code: 'openai_key_missing',
};
const KEY_INVALID = {
  error: 'OpenAI rejected your API key. Update it in Settings → AI.',
  code: 'openai_key_invalid',
};

export async function onRequest(context: { request: Request }) {
  const { request } = context;

  const auth = await verifyAuth(request);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const action = url.pathname.split('/').filter(Boolean).pop();

  try {
    if (action === 'recommendations' && request.method === 'GET') {
      return await handleGetRecommendations(auth.uid, url);
    }

    const isChat = action === 'chat' && request.method === 'POST';
    const isRecommendations = action === 'recommendations' && request.method === 'POST';
    if (!isChat && !isRecommendations) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    // Every user brings their own key - there is no shared server key.
    const apiKey = await getOpenAIKey(auth.uid);
    if (!apiKey) {
      return jsonResponse(KEY_MISSING, 400);
    }

    return isChat
      ? await handleChat(auth.uid, apiKey, request)
      : await handleRecommendations(auth.uid, apiKey, request);
  } catch (error) {
    if (error instanceof InvalidOpenAIKeyError) {
      return jsonResponse(KEY_INVALID, 400);
    }
    console.error('OpenAI proxy error:', { action, message: (error as Error).message });
    return jsonResponse({ error: (error as Error).message || 'Internal server error' }, 500);
  }
}

async function handleChat(uid: string, apiKey: string, request: Request) {
  const body = await request.json().catch(() => ({}) as any);
  if (!isValidMessages(body.messages)) {
    return jsonResponse({ error: 'messages array is required' }, 400);
  }

  // The messages array may embed untrusted text pulled from the connected
  // store (product names, order data) alongside the user's own message -
  // never forward it to OpenAI unsanitized, regardless of what the client
  // claims it already did on its end.
  const { messages, flaggedCount } = sanitizeMessages(body.messages);
  if (flaggedCount > 0) {
    console.warn('Potential prompt injection neutralized in chat request', { uid, flaggedCount });
  }

  const data = await chatCompletion(apiKey, {
    model: chatModel(),
    messages,
    max_completion_tokens: 1000,
  });

  return jsonResponse({ message: data.choices[0].message });
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

async function handleRecommendations(uid: string, apiKey: string, request: Request) {
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

  const data = await chatCompletion(apiKey, {
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
