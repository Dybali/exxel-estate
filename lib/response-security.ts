/** Preserve route-specific policies, cookies and streaming bodies. */
export function withResponseSecurity(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('Referrer-Policy')) headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
