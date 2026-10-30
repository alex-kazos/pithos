import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyAuth = vi.fn();
const saveOpenAIKey = vi.fn();
const getOpenAIKeyStatus = vi.fn();
const deleteOpenAIKey = vi.fn();
const getPreferences = vi.fn();
const updatePreferences = vi.fn();

vi.mock('../lib/auth', () => ({ verifyAuth: (...args: unknown[]) => verifyAuth(...args) }));
vi.mock('../lib/userSettings', () => ({
  saveOpenAIKey: (...args: unknown[]) => saveOpenAIKey(...args),
  getOpenAIKeyStatus: (...args: unknown[]) => getOpenAIKeyStatus(...args),
  deleteOpenAIKey: (...args: unknown[]) => deleteOpenAIKey(...args),
  getPreferences: (...args: unknown[]) => getPreferences(...args),
  updatePreferences: (...args: unknown[]) => updatePreferences(...args),
}));

import { settingsRoutes } from './settings';

const ORIGINAL_FETCH = global.fetch;
const KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';

function putKey(apiKey: unknown) {
  return settingsRoutes.request('/openai-key', { method: 'PUT', body: JSON.stringify({ apiKey }) });
}

describe('/api/settings', () => {
  beforeEach(() => {
    for (const fn of [verifyAuth, saveOpenAIKey, getOpenAIKeyStatus, deleteOpenAIKey, getPreferences, updatePreferences]) fn.mockReset();
    verifyAuth.mockResolvedValue({ uid: 'user-1', email: null });
    saveOpenAIKey.mockResolvedValue({ configured: true, hint: '…3456' });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('requires a session', async () => {
    verifyAuth.mockResolvedValueOnce(null);
    expect((await putKey(KEY)).status).toBe(401);
    expect(saveOpenAIKey).not.toHaveBeenCalled();
  });

  it('checks a new OpenAI key with OpenAI, then saves it and returns only a hint', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await putKey(`  ${KEY}  `);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ configured: true, hint: '…3456' });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(saveOpenAIKey).toHaveBeenCalledWith('user-1', KEY);
    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it('refuses a key OpenAI rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401 });
    const response = await putKey(KEY);
    expect(response.status).toBe(400);
    expect(saveOpenAIKey).not.toHaveBeenCalled();
  });

  it('still saves (with a warning) when the key cannot be checked right now', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));
    const body = await (await putKey(KEY)).json();
    expect(saveOpenAIKey).toHaveBeenCalled();
    expect(body.warning).toMatch(/could not be checked/);
  });

  it('rejects input that is clearly not a key without calling OpenAI', async () => {
    expect((await putKey('short')).status).toBe(400);
    expect((await putKey('has spaces in the middle of it ok')).status).toBe(400);
    expect((await putKey(42)).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('removes the key', async () => {
    const response = await settingsRoutes.request('/openai-key', { method: 'DELETE' });
    expect(await response.json()).toEqual({ configured: false, hint: null });
    expect(deleteOpenAIKey).toHaveBeenCalledWith('user-1');
  });

  it('merges preference updates and rejects non-objects', async () => {
    updatePreferences.mockResolvedValueOnce({ theme: 'light' });
    const response = await settingsRoutes.request('/preferences', { method: 'PUT', body: JSON.stringify({ theme: 'light' }) });
    expect(await response.json()).toEqual({ preferences: { theme: 'light' } });
    expect(updatePreferences).toHaveBeenCalledWith('user-1', { theme: 'light' });

    expect((await settingsRoutes.request('/preferences', { method: 'PUT', body: '[1,2]' })).status).toBe(400);
  });
});
