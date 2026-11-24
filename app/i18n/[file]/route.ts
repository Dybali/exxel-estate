import { isLocale, messagesFor, messagesVersion } from "@/lib/i18n-dictionary";
import { compressedBody } from "@/lib/response-compression";

// /i18n/<locale>.json: one language's messages for the browser (lib/i18n-runtime.ts). With the current
// ?v=<version> the response is cached for a year; any other request is cached briefly.
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const locale = file.replace(/\.json$/, "");
  if (!isLocale(locale) || !file.endsWith(".json")) return new Response("Not found", { status: 404 });
  const current = new URL(request.url).searchParams.get("v") === messagesVersion();
  // The current version is compressed once per server start (strongest Brotli) and kept in memory.
  const { body, headers } = compressedBody(JSON.stringify(messagesFor(locale)), request, current ? `i18n:${locale}:${messagesVersion()}` : undefined);
  return new Response(body, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
}
