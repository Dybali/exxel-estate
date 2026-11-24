// Local development without R2 settings (npm run dev): a small S3 stand-in that keeps objects as files under
// .data/storage/<bucket>/<key>, so photo, document and video uploads can be tried on this machine end to end. It
// implements the part of the S3 API the site uses (PUT, GET with If-Match, HEAD, DELETE, ListObjectsV2) for
// lib/external-r2.ts and lib/private-bucket.ts. Only when NODE_ENV is "development" (next dev); never in
// production or tests. Built-ins are loaded lazily so the production server never touches this code path.
type Meta = { contentType: string; etag: string; meta: Record<string, string>; modified: string; size: number };
export const DEV_STORAGE_ORIGIN = "https://dev-storage.invalid";

export function devStorageEnabled() { return process.env.NODE_ENV === "development"; }

export function devStorageFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const getBuiltin = (process as unknown as { getBuiltinModule: (id: string) => unknown }).getBuiltinModule;
  const fs = getBuiltin("node:fs") as typeof import("node:fs"), path = getBuiltin("node:path") as typeof import("node:path"), crypto = getBuiltin("node:crypto") as typeof import("node:crypto");
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  const root = path.join(process.cwd(), ".data", "storage");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const bucket = parts.shift() || "";
  if (!/^[a-z0-9-]+$/.test(bucket) || parts.some((p) => p === ".." || p === "." || p.includes("\0"))) return Promise.resolve(new Response("bad key", { status: 400 }));
  const key = parts.join("/"), file = path.join(root, bucket, ...parts), metaFile = file + ".meta.json";
  const readMeta = (): Meta | null => { try { return JSON.parse(fs.readFileSync(metaFile, "utf8")) as Meta; } catch { return null; } };
  const metaHeaders = (m: Meta) => { const h = new Headers({ "content-type": m.contentType, "content-length": String(m.size), etag: `"${m.etag}"`, "last-modified": new Date(m.modified).toUTCString() }); for (const [k, v] of Object.entries(m.meta)) h.set(`x-amz-meta-${k}`, v); return h; };
  return (async () => {
    // ListObjectsV2 on the bucket.
    if (method === "GET" && !key && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") || "", max = Number(url.searchParams.get("max-keys") || 1000), dir = path.join(root, bucket);
      const walk = (d: string): string[] => { try { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".meta.json") ? [] : [path.join(d, e.name)]); } catch { return []; } };
      const keys = walk(dir).map((f) => path.relative(dir, f).split(path.sep).join("/")).filter((k) => k.startsWith(prefix)).sort().slice(0, max);
      const items = keys.map((k) => { let m: Meta | null = null; try { m = JSON.parse(fs.readFileSync(path.join(dir, ...k.split("/")) + ".meta.json", "utf8")); } catch { /* no metadata */ } return `<Contents><Key>${k.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Key><Size>${m?.size ?? 0}</Size><ETag>&quot;${m?.etag ?? ""}&quot;</ETag><LastModified>${m?.modified ?? new Date(0).toISOString()}</LastModified></Contents>`; }).join("");
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>false</IsTruncated>${items}</ListBucketResult>`, { headers: { "content-type": "application/xml" } });
    }
    if (method === "PUT") {
      const body = init.body;
      const bytes = body == null ? new Uint8Array() : typeof body === "string" ? new TextEncoder().encode(body) : body instanceof ArrayBuffer ? new Uint8Array(body) : ArrayBuffer.isView(body) ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength) : new Uint8Array(await new Response(body as BodyInit).arrayBuffer());
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      const meta: Record<string, string> = {};
      headers.forEach((value, name) => { if (name.startsWith("x-amz-meta-")) meta[name.slice(11)] = value; });
      const m: Meta = { contentType: headers.get("content-type") || "application/octet-stream", etag: crypto.createHash("md5").update(bytes).digest("hex"), meta, modified: new Date().toISOString(), size: bytes.byteLength };
      fs.writeFileSync(metaFile, JSON.stringify(m));
      return new Response(null, { status: 200, headers: { etag: `"${m.etag}"` } });
    }
    if (method === "DELETE") { try { fs.unlinkSync(file); fs.unlinkSync(metaFile); } catch { /* already gone */ } return new Response(null, { status: 204 }); }
    const m = readMeta();
    if (!m || !fs.existsSync(file)) return new Response(null, { status: 404 });
    const match = headers.get("if-match");
    if (match && match.replace(/"/g, "") !== m.etag) return new Response(null, { status: 412, headers: metaHeaders(m) });
    if (method === "HEAD") return new Response(null, { status: 200, headers: metaHeaders(m) });
    return new Response(fs.readFileSync(file), { status: 200, headers: metaHeaders(m) });
  })();
}
