// Response compression slot. Cloudflare compresses every response itself, so this build (vinext) sends the
// body as it is. The Node build for the Mittwald container aliases "@/lib/response-compression" to
// lib/response-compression-node.ts (next.config.ts): the Next.js server compresses pages but not route
// handler responses, so large JSON such as /i18n/<locale>.json (≈440 KB) is gzipped there.
export function compressedBody(body: string, _request: Request, _cacheKey?: string): { body: BodyInit; headers: Record<string, string> } {
  return { body, headers: {} };
}
