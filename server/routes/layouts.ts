import { Hono } from 'hono';
import { requireUser, type AuthedEnv } from '../lib/requireUser';
import { getLayoutPreset, setLayoutPreset } from '../lib/layouts';

/** Which Overview layout preset each store view uses. */
export const layoutsRoutes = new Hono<AuthedEnv>();

layoutsRoutes.use('*', requireUser);

const MAX_KEY_LENGTH = 200;

layoutsRoutes.get('/:storeKey', async c => {
  const storeKey = c.req.param('storeKey');
  if (storeKey.length > MAX_KEY_LENGTH) return c.json({ error: 'storeKey is too long' }, 400);
  return c.json({ preset: await getLayoutPreset(c.var.user.uid, storeKey) });
});

layoutsRoutes.put('/:storeKey', async c => {
  const storeKey = c.req.param('storeKey');
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const preset = typeof body.preset === 'string' ? body.preset : '';
  if (storeKey.length > MAX_KEY_LENGTH || !preset || preset.length > 100) {
    return c.json({ error: 'A preset id is required' }, 400);
  }
  await setLayoutPreset(c.var.user.uid, storeKey, preset);
  return c.json({ preset });
});
