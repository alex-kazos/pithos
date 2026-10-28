/**
 * Server-side defense against prompt injection for the AI chat/recommendations
 * proxy. This is the real security boundary: the client also frames and caps
 * untrusted store data before building a prompt, but that's easily bypassed
 * by anyone calling this endpoint directly with a valid Firebase token, so
 * every message is re-sanitized here regardless of what the client sent.
 *
 * This can't make prompt injection impossible (no purely textual filter can),
 * but it meaningfully raises the bar by neutralizing the common injection
 * patterns and bounding how much untrusted text (e.g. from product/order
 * data pulled off a connected store) can reach the model in one request.
 */

const INJECTION_PATTERNS: RegExp[] = [
  // Attempts to override prior instructions
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
  /disregard\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
  /forget\s+(all\s+|everything\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
  /new\s+instructions?\s*:/gi,
  /you\s+are\s+now\s+/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?/gi,
  /your\s+(new|real|true)\s+(role|task|instructions?|purpose)\s+is/gi,
  // Attempts to fake conversation structure / role boundaries
  /^\s*system\s*:/gim,
  /^\s*assistant\s*:/gim,
  /<\|.*?\|>/g, // special chat-template tokens (e.g. <|im_start|>)
  /\[INST\]|\[\/INST\]/gi,
  // Attempts to get the model to reveal or discard its system prompt
  /reveal\s+(your\s+)?(system\s+)?prompt/gi,
  /print\s+(your\s+)?(system\s+)?prompt/gi,
];

const MAX_MESSAGE_LENGTH = 8000;
const MAX_MESSAGES = 60;

export interface SanitizedMessage {
  role: string;
  content: string;
}

/**
 * Neutralizes known injection patterns and caps length. Applied to every
 * message - including the user's own - so the check is uniform and can't be
 * routed around by claiming a message is "just data".
 */
export function sanitizeText(input: string, maxLength = MAX_MESSAGE_LENGTH): { text: string; flagged: boolean } {
  let text = typeof input === 'string' ? input.slice(0, maxLength) : '';
  let flagged = false;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flagged = true;
    }
    text = text.replace(pattern, '[redacted]');
  }

  return { text, flagged };
}

/**
 * Sanitizes a full chat-completion messages array before it's forwarded to
 * OpenAI: caps the number of messages, sanitizes each message's content, and
 * reports whether anything was flagged (for logging - never blocks the
 * request outright, since a false positive would just break legitimate use;
 * neutralizing the pattern is the actual defense).
 */
export function sanitizeMessages(messages: Array<{ role: string; content: string }>): {
  messages: SanitizedMessage[];
  flaggedCount: number;
} {
  const trimmed = messages.slice(-MAX_MESSAGES);
  let flaggedCount = 0;

  const sanitized = trimmed.map(m => {
    const { text, flagged } = sanitizeText(m.content);
    if (flagged) flaggedCount++;
    return { role: m.role, content: text };
  });

  return { messages: sanitized, flaggedCount };
}
