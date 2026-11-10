/**
 * The frontend is served from the same origin as the API, so responses
 * carry no CORS headers: other sites can't call these endpoints with a
 * user's session cookie.
 */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
