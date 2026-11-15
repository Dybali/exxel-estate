import { NextResponse, type NextRequest } from "next/server";
import { negotiateLocale } from "./lib/locale-negotiation";
import { LOCALE_HEADER, PATH_HEADER } from "./lib/request-headers";
import { applySecurityHeaders, NOINDEX_HOST_TAG, temporaryHost } from "./lib/response-security";

// Request context for the standard Next.js server (Mittwald container): pass the language and the path
// to server components, replacing any client-supplied values, and add the basic security
// headers. On Cloudflare build/sites-worker.ts does the same, so running both is harmless.
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  const headers = new Headers(request.headers);
  // ?lang, the saved choice, then the browser's languages (lib/locale-negotiation.ts).
  headers.set(LOCALE_HEADER, negotiateLocale(lang, request.headers.get("cookie"), request.headers.get("accept-language")));
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  // Temporary and test addresses (Mittwald project domain, test.*, *.workers.dev, *.chatgpt.site) must
  // stay out of search results (lib/response-security.ts). Behind Mittwald's proxy nextUrl carries the
  // internal host; the public one is in the headers.
  if (temporaryHost(request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname)) response.headers.set("X-Robots-Tag", NOINDEX_HOST_TAG);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  // Static assets never need the language context. The video upload (api/video-upload) is skipped
  // too: for requests the proxy sees, Next.js copies the body into memory and cuts it at 10 MB.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|icons/|brand/|flags/|fonts/|vendor/|sw.js|manifest.webmanifest|api/video-upload).*)"],
};
