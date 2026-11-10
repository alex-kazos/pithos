import { Hono } from 'hono';
import { requireUser, type AuthedEnv } from '../lib/requireUser';
import {
  deleteOpenAIKey,
  getOpenAIKeyStatus,
  getPreferences,
  saveOpenAIKey,
  updatePreferences,
} from '../lib/userSettings';
import { verifyOpenAIKey } from '../lib/openai';

export const settingsRoutes = new Hono<AuthedEnv>();

settingsRoutes.use('*', requireUser);

const MAX_PREFERENCES_BYTES = 10_000;

settingsRoutes.get('/preferences', async c => {
  return c.json({ preferences: await getPreferences(c.var.user.uid) });
});

settingsRoutes.put('/preferences', async c => {
  const patch = await c.req.json().catch(() => null);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return c.json({ error: 'Expected a JSON object of preferences' }, 400);
  }
  if (JSON.stringify(patch).length > MAX_PREFERENCES_BYTES) {
    return c.json({ error: 'Preferences are too large' }, 413);
  }
  return c.json({ preferences: await updatePreferences(c.var.user.uid, patch) });
});

/** Whether the user has saved an OpenAI key - never the key itself. */
settingsRoutes.get('/openai-key', async c => {
  return c.json(await getOpenAIKeyStatus(c.var.user.uid));
});

settingsRoutes.put('/openai-key', async c => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (apiKey.length < 20 || apiKey.length > 300 || /\s/.test(apiKey)) {
    return c.json({ error: 'That doesn\'t look like an OpenAI API key.' }, 400);
  }

  const verdict = await verifyOpenAIKey(apiKey);
  if (verdict === 'invalid') {
    return c.json({ error: 'OpenAI rejected this key. Check it and try again.' }, 400);
  }

  const status = await saveOpenAIKey(c.var.user.uid, apiKey);
  return c.json({
    ...status,
    // Saved anyway: the provider may be down, or an OpenAI-compatible
    // endpoint may not implement the models list used for the check.
    warning: verdict === 'unreachable' ? 'Saved, but the key could not be checked right now.' : undefined,
  });
});

settingsRoutes.delete('/openai-key', async c => {
  await deleteOpenAIKey(c.var.user.uid);
  return c.json({ configured: false, hint: null });
});
