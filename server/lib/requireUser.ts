import { createMiddleware } from 'hono/factory';
import { verifyAuth, type AuthResult } from './auth';

export type AuthedEnv = { Variables: { user: AuthResult } };

/** Rejects requests without a valid session; otherwise exposes `c.var.user`. */
export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  const user = await verifyAuth(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  c.set('user', user);
  await next();
});
