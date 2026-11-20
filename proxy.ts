import { NextResponse, type NextRequest } from "next/server";
import { negotiateLocale } from "./lib/locale-negotiation";
import { LOCALE_HEADER, PATH_HEADER } from "./lib/request-headers";
import { applySecurityHeaders, NOINDEX_HOST_TAG, temporaryHost } from "./lib/response-security";

// Request context for the standard Next.js server (Mittwald container): pass the language and the path
// to server components, replacing any client-supplied values, and add the basic security
// headers. On Cloudflare build/sites-worker.ts does the same, so running both is harmless.
// Old addresses that moved for good: answer with a real 308 here instead of the page-level redirect,
// which a streamed page can only send as a 200 with a meta refresh.
const MOVED: Record<string, string> = { "/sezonluk-kiralik": "/ilanlar?purpose=gunluk", "/fiyati-dusen-ilanlar": "/ilanlar?priceDrop=1" };

export function proxy(request: NextRequest) {
  const moved = MOVED[request.nextUrl.pathname.replace(/\/+$/, "")];
  if (moved) {
    const target = new URL(moved, request.url);
    request.nextUrl.searchParams.forEach((value, key) => { if (!target.searchParams.has(key)) target.searchParams.set(key, value); });
    return NextResponse.redirect(target, 308);
  }
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
