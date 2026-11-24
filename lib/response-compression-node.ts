import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Node (Mittwald) version of lib/response-compression.ts: Brotli or gzip, whichever the browser accepts.
// With a `cacheKey` (stable content such as /i18n/<locale>.json?v=<version>) the strongest Brotli setting is
// used once and the result is kept in memory: about 20% smaller than gzip (live-site sweep 2026-11-24).
const memo = new Map<string, Uint8Array<ArrayBuffer>>();
const MEMO_LIMIT = 64;
const bytes = (buffer: Buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as Uint8Array<ArrayBuffer>;

export function compressedBody(body: string, request: Request, cacheKey?: string): { body: BodyInit; headers: Record<string, string> } {
  const accepted = request.headers.get("accept-encoding") || "";
  if (/\bbr\b/.test(accepted)) {
    const key = cacheKey ? `br:${cacheKey}` : "";
    let out = key ? memo.get(key) : undefined;
    if (!out) {
      out = bytes(brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: cacheKey ? 11 : 5, [constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(body) } }));
      if (key) { if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value!); memo.set(key, out); }
    }
    return { body: out, headers: { "Content-Encoding": "br", Vary: "Accept-Encoding" } };
  }
  if (!/\bgzip\b/.test(accepted)) return { body, headers: { Vary: "Accept-Encoding" } };
  return { body: bytes(gzipSync(body)), headers: { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } };
}
