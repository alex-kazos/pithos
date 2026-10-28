/**
 * Server-only OpenAI client. The API key never reaches the browser - the
 * frontend calls functions/api/openai/[[path]].ts with a Firebase ID token,
 * and this is the only place that talks to OpenAI directly.
 *
 * Every deployment brings its own key (OPENAI_API_KEY). OPENAI_BASE_URL
 * points it at any OpenAI-compatible Chat Completions endpoint instead
 * (Azure OpenAI, OpenRouter, a local server, ...).
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

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chatCompletion(params: ChatCompletionParams): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  // Optional - only needed for API keys scoped to a specific project.
  if (process.env.OPENAI_PROJECT_ID) {
    headers['OpenAI-Project'] = process.env.OPENAI_PROJECT_ID;
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as any));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  return response.json();
}
