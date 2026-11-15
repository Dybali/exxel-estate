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
// Temporary and test addresses must stay out of search results: the Mittwald project domain, test.*,
// the Cloudflare Worker address (*.workers.dev) and the old ChatGPT Sites publication (*.chatgpt.site).
// Only the site's own domain is indexed.
export const NOINDEX_HOST_TAG = "noindex, nofollow";
export function temporaryHost(host: string | null | undefined) {
  const name = (host || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return name.endsWith(".project.space") || name.startsWith("test.") || name.endsWith(".workers.dev") || name.endsWith(".chatgpt.site");
}
/** Preserve route-specific policies, cookies and streaming bodies. `noindex` adds X-Robots-Tag (temporary hosts). */
export function withResponseSecurity(response: Response, options: { noindex?: boolean } = {}): Response {
  if (response.status === 101) return response;
  const headers = applySecurityHeaders(new Headers(response.headers));
  if (options.noindex) headers.set("X-Robots-Tag", NOINDEX_HOST_TAG);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
