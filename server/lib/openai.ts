/**
 * Server-only OpenAI client. Every call uses the signed-in user's own API
 * key (saved encrypted in Settings - see lib/userSettings.ts); the key never
 * travels back to the browser.
 *
 * OPENAI_BASE_URL points the whole deployment at any OpenAI-compatible Chat
 * Completions endpoint instead (Azure OpenAI, OpenRouter, a local server, ...).
 */
export interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  // GPT-5 series models reject the legacy `max_tokens` and `temperature`
  // params outright (400 "Unsupported parameter") - max_completion_tokens
  // is the only supported output-length control, and temperature is fixed.
  max_completion_tokens?: number;
  response_format?: { type: string };
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function headersFor(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/** Raised for a key OpenAI rejects, so callers can ask the user to replace it. */
export class InvalidOpenAIKeyError extends Error {}

export async function chatCompletion(apiKey: string, params: ChatCompletionParams): Promise<any> {
  const response = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as any));
    const message = errorData.error?.message || `OpenAI API error: ${response.status}`;
    if (response.status === 401) throw new InvalidOpenAIKeyError(message);
    throw new Error(message);
  }

  return response.json();
}

/**
 * Checks a key before it is saved, with a free call (listing models), so a
 * typo surfaces in Settings instead of on the user's first chat message.
 */
export async function verifyOpenAIKey(apiKey: string): Promise<'valid' | 'invalid' | 'unreachable'> {
  try {
    const response = await fetch(`${baseUrl()}/models`, { headers: headersFor(apiKey) });
    if (response.ok) return 'valid';
    if (response.status === 401 || response.status === 403) return 'invalid';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}
