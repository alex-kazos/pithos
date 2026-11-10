/**
 * Reads a JSON body from one of the app's own /api routes.
 *
 * `response.json()` throws "Unexpected end of JSON input" (or "Unexpected
 * token '<'") when a route answers with an empty body or an HTML error page
 * - which is what happens when the /api functions aren't running in front of
 * the SPA. That message tells the user nothing about what actually went
 * wrong, and it surfaces verbatim in connection dialogs, so read the body as
 * text first and report the status we actually got.
 */
export async function readJsonResponse<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`The Pithos API returned an empty response (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The Pithos API returned an unexpected response (HTTP ${response.status}).`);
  }
}

/**
 * Best-effort variant for paths that only want an error message out of a
 * failed response and have their own fallback. Never throws.
 */
export async function readJsonResponseOrEmpty<T = Record<string, unknown>>(response: Response): Promise<Partial<T>> {
  try {
    return await readJsonResponse<T>(response);
  } catch {
    return {};
  }
}
