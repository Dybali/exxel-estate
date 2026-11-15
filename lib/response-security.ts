// Headers every response gets, on Cloudflare (build/sites-worker.ts) and on the Node server (proxy.ts).
// Pages may be framed only by the site itself (document previews use same-origin iframes), plugins
// are off and <base> cannot be changed. A route that sets its own Content-Security-Policy (private
// documents: sandbox) or X-Frame-Options keeps it.
export const FRAME_POLICY = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
export const HSTS = "max-age=31536000";
export function applySecurityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', FRAME_POLICY);
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'SAMEORIGIN');
  if (!headers.has('Strict-Transport-Security')) headers.set('Strict-Transport-Security', HSTS);
  return headers;
}
/** Preserve route-specific policies, cookies and streaming bodies. */
export function withResponseSecurity(response: Response): Response {
  if (response.status === 101) return response;
  const headers = applySecurityHeaders(new Headers(response.headers));
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
