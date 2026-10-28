import { getDoc, setDoc } from './firestoreRest';

// Per-user monthly cap on AI chat messages - every message is billed to the
// deployment's own OPENAI_API_KEY, so this keeps one account from running
// up the bill. Override with AI_CHAT_MONTHLY_LIMIT.
const DEFAULT_CHAT_MONTHLY_LIMIT = 120;

function chatMonthlyLimit(): number {
  return Number(process.env.AI_CHAT_MONTHLY_LIMIT) || DEFAULT_CHAT_MONTHLY_LIMIT;
}

// Recommendations are generated once per store and reused for up to a week,
// rather than metered per click like chat. A manual refresh always
// regenerates regardless of this window - it only governs the passive
// "still fresh enough to show without asking OpenAI again" check.
const RECOMMENDATIONS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ChatUsageResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string;
}

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nextPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function readChatUsage(uid: string): Promise<{ period: string; used: number; limit: number }> {
  const period = currentPeriodKey();
  const doc = await getDoc(`users/${uid}/aiUsage/chat`);
  const data = doc.exists ? doc.data() : null;
  const isSamePeriod = data?.period === period;
  const used = isSamePeriod ? (data?.count as number) || 0 : 0;
  return { period, used, limit: chatMonthlyLimit() };
}

export async function getChatUsageStatus(uid: string): Promise<ChatUsageResult> {
  const { used, limit } = await readChatUsage(uid);
  return { allowed: used < limit, used, limit, resetsAt: nextPeriodStart().toISOString() };
}

/**
 * Reads current usage and, if under the monthly cap, atomically-enough
 * increments it (read-then-write; a soft usage cap, not a hard security
 * boundary, so the small race window under concurrent requests is fine).
 */
export async function checkAndConsumeChatQuota(uid: string): Promise<ChatUsageResult> {
  const { period, used, limit } = await readChatUsage(uid);
  const resetsAt = nextPeriodStart().toISOString();

  if (used >= limit) {
    return { allowed: false, used, limit, resetsAt };
  }

  const nextUsed = used + 1;
  await setDoc(`users/${uid}/aiUsage/chat`, {
    period,
    count: nextUsed,
    updatedAt: new Date().toISOString(),
  });

  return { allowed: true, used: nextUsed, limit, resetsAt };
}

export interface CachedRecommendations {
  recommendations: unknown[];
  generatedAt: string;
  isStale: boolean;
}

function recommendationsDocPath(uid: string, storeKey: string): string {
  return `users/${uid}/aiUsage/recommendations_${storeKey}`;
}

export async function getCachedRecommendations(uid: string, storeKey: string): Promise<CachedRecommendations | null> {
  const doc = await getDoc(recommendationsDocPath(uid, storeKey));
  if (!doc.exists) return null;

  const data = doc.data();
  const generatedAt = data?.generatedAt as string | undefined;
  const recommendations = data?.recommendations as unknown[] | undefined;
  if (!generatedAt || !Array.isArray(recommendations)) return null;

  const isStale = Date.now() - new Date(generatedAt).getTime() >= RECOMMENDATIONS_CACHE_TTL_MS;
  return { recommendations, generatedAt, isStale };
}

export async function saveRecommendations(
  uid: string,
  storeKey: string,
  recommendations: unknown[]
): Promise<CachedRecommendations> {
  const generatedAt = new Date().toISOString();
  await setDoc(recommendationsDocPath(uid, storeKey), { recommendations, generatedAt });
  return { recommendations, generatedAt, isStale: false };
}
