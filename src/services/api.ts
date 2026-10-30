import { readJsonResponse } from '../utils/apiResponse';
import type { StoreConnectionRecord } from './storeHealthService';

/**
 * Typed client for StockPilot's own /api routes (server/app.ts). Requests
 * are same-origin, so the session cookie rides along automatically.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const data = await readJsonResponse<Record<string, unknown>>(response);
  if (!response.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : `Request failed (HTTP ${response.status})`,
      response.status,
      typeof data.code === 'string' ? data.code : undefined
    );
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// --- Deployment config -----------------------------------------------------

export interface AppConfig {
  /** "Continue with Google" is available (GOOGLE_CLIENT_ID/SECRET are set). */
  googleSignIn: boolean;
  /** One-click Shopify connect is available (a Shopify app is configured). */
  shopifyOAuth: boolean;
}

let configPromise: Promise<AppConfig> | null = null;

export function getConfig(): Promise<AppConfig> {
  configPromise ??= request<AppConfig>('/api/config').catch(error => {
    configPromise = null;
    throw error;
  });
  return configPromise;
}

// --- Stores ----------------------------------------------------------------

export type StorePlatform = 'shopify' | 'woocommerce';

/** A connected store as the browser sees it - credentials never leave the server. */
export interface StoreSummary {
  id: string;
  platform: StorePlatform;
  /** Shop domain (Shopify) or store URL (WooCommerce). */
  url: string;
  authMethod: string;
  isActive: boolean;
  connection: StoreConnectionRecord | null;
  createdAt: string;
}

export async function listStores(): Promise<StoreSummary[]> {
  return (await request<{ stores: StoreSummary[] }>('/api/stores')).stores;
}

export async function connectShopifyStore(shop: string, apiToken: string): Promise<StoreSummary> {
  return (await request<{ store: StoreSummary }>('/api/stores', { method: 'POST', ...json({ platform: 'shopify', shop, apiToken }) })).store;
}

export async function connectWooCommerceStore(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<StoreSummary> {
  return (
    await request<{ store: StoreSummary }>('/api/stores', {
      method: 'POST',
      ...json({ platform: 'woocommerce', storeUrl, consumerKey, consumerSecret }),
    })
  ).store;
}

export async function deleteStore(storeId: string): Promise<void> {
  await request(`/api/stores/${encodeURIComponent(storeId)}`, { method: 'DELETE' });
}

export async function activateStore(storeId: string): Promise<void> {
  await request(`/api/stores/${encodeURIComponent(storeId)}/activate`, { method: 'POST' });
}

export async function recordStoreConnection(storeId: string, record: StoreConnectionRecord): Promise<void> {
  await request(`/api/stores/${encodeURIComponent(storeId)}/connection`, { method: 'PUT', ...json(record) });
}

/** Starts a Shopify/WooCommerce connect flow and returns the URL to send the browser to. */
export async function startStoreOAuth(
  platform: StorePlatform,
  target: string,
  onboarding: boolean
): Promise<string> {
  const body = platform === 'shopify' ? { shop: target, onboarding } : { storeUrl: target, onboarding };
  return (await request<{ url: string }>(`/api/${platform}/oauth/start`, { method: 'POST', ...json(body) })).url;
}

// --- Settings --------------------------------------------------------------

export async function getPreferences<T>(): Promise<Partial<T>> {
  return (await request<{ preferences: Partial<T> }>('/api/settings/preferences')).preferences;
}

export async function updatePreferences<T>(patch: Partial<T>): Promise<void> {
  await request('/api/settings/preferences', { method: 'PUT', ...json(patch) });
}

export interface OpenAIKeyStatus {
  configured: boolean;
  /** Last characters of the saved key, e.g. "…a1b2". */
  hint: string | null;
  warning?: string;
}

export function getOpenAIKeyStatus(): Promise<OpenAIKeyStatus> {
  return request<OpenAIKeyStatus>('/api/settings/openai-key');
}

export function saveOpenAIKey(apiKey: string): Promise<OpenAIKeyStatus> {
  return request<OpenAIKeyStatus>('/api/settings/openai-key', { method: 'PUT', ...json({ apiKey }) });
}

export function deleteOpenAIKey(): Promise<OpenAIKeyStatus> {
  return request<OpenAIKeyStatus>('/api/settings/openai-key', { method: 'DELETE' });
}

// --- Dashboard layouts -----------------------------------------------------

export async function getLayoutPreset(storeKey: string): Promise<string | null> {
  return (await request<{ preset: string | null }>(`/api/layouts/${encodeURIComponent(storeKey)}`)).preset;
}

export async function setLayoutPreset(storeKey: string, preset: string): Promise<void> {
  await request(`/api/layouts/${encodeURIComponent(storeKey)}`, { method: 'PUT', ...json({ preset }) });
}

// --- Account ---------------------------------------------------------------

export async function deleteAccount(): Promise<void> {
  await request('/api/account/delete', { method: 'POST' });
}
