import { gzipSync } from "node:zlib";

// Node (Mittwald) version of lib/response-compression.ts: gzip when the browser accepts it.
export function compressedBody(body: string, request: Request): { body: BodyInit; headers: Record<string, string> } {
  if (!/\bgzip\b/.test(request.headers.get("accept-encoding") || "")) return { body, headers: { Vary: "Accept-Encoding" } };
  return { body: new Uint8Array(gzipSync(body)), headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } };
}
