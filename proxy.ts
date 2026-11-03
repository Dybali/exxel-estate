import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "./lib/i18n-dictionary";
import { LOCALE_HEADER, PATH_HEADER } from "./lib/request-headers";

// Request context for the standard Next.js server (Mittwald container): pass ?lang and the path
// to server components, replacing any client-supplied values, and add the basic security
// headers. On Cloudflare build/sites-worker.ts does the same, so running both is harmless.
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang");
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, isLocale(lang) ? lang : "tr");
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Temporary and test addresses (Mittwald project domain, test.*) must stay out of search results.
  // Behind Mittwald's proxy nextUrl carries the internal host; the public one is in the headers.
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.hostname).split(",")[0].trim().replace(/:\d+$/, "");
  if (host.endsWith(".project.space") || host.startsWith("test.")) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (!response.headers.has("Referrer-Policy")) response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  // Static assets never need the language context.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|icons/|brand/|flags/|fonts/|vendor/|sw.js|manifest.webmanifest).*)"],
};
