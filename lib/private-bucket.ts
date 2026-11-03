import { AwsClient } from "aws4fetch";
import { env } from "./runtime";

// The private R2 bucket (exxel-estate-private, EU) through R2's S3 API, for hosts without the
// Cloudflare BUCKET binding (the Mittwald container). It implements only the part of the R2Bucket
// API the site uses: get (with onlyIf.etagMatches), head, put (httpMetadata.contentType,
// customMetadata), delete (one key or a list) and list (limit, cursor, prefix). Credentials are the
// same R2_* settings as the listing photos (lib/external-r2.ts); the R2 token must also allow
// this bucket. lib/server.ts bucket() prefers the binding when it exists.

export type PrivateBucketSettings = {
  R2_ENDPOINT?: string;
  R2_PRIVATE_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};
export const DEFAULT_PRIVATE_BUCKET = "exxel-estate-private";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ObjectInfo = {
  key: string; size: number; etag: string; httpEtag: string; uploaded: Date;
  httpMetadata: { contentType?: string; contentDisposition?: string; contentEncoding?: string; contentLanguage?: string; cacheControl?: string };
  customMetadata: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
};

const unquote = (etag: string) => etag.replace(/^W\//, "").replace(/^"|"$/g, "");
const xmlText = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => { const match = xml.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">")); return match ? xmlText(match[1]) : null; };

function info(key: string, headers: Headers): ObjectInfo {
  const etag = unquote(headers.get("etag") || "");
  const httpMetadata = {
    contentType: headers.get("content-type") || undefined, contentDisposition: headers.get("content-disposition") || undefined,
    contentEncoding: headers.get("content-encoding") || undefined, contentLanguage: headers.get("content-language") || undefined,
    cacheControl: headers.get("cache-control") || undefined,
  };
  const modified = headers.get("last-modified");
  return {
    key, size: Number(headers.get("content-length") || 0), etag, httpEtag: `"${etag}"`, uploaded: modified ? new Date(modified) : new Date(0),
    httpMetadata, customMetadata: Object.fromEntries([...headers.entries()].filter(([name]) => name.startsWith("x-amz-meta-")).map(([name, value]) => [name.slice(11), value])),
    writeHttpMetadata(target: Headers) {
      if (httpMetadata.contentType) target.set("content-type", httpMetadata.contentType);
      if (httpMetadata.contentDisposition) target.set("content-disposition", httpMetadata.contentDisposition);
      if (httpMetadata.contentEncoding) target.set("content-encoding", httpMetadata.contentEncoding);
      if (httpMetadata.contentLanguage) target.set("content-language", httpMetadata.contentLanguage);
      if (httpMetadata.cacheControl) target.set("cache-control", httpMetadata.cacheControl);
    },
  };
}

export function s3PrivateBucket(settings: PrivateBucketSettings) {
  const { R2_ENDPOINT: endpoint, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = settings;
  const name = settings.R2_PRIVATE_BUCKET_NAME || DEFAULT_PRIVATE_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  if (!/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(endpoint) || !/^[a-z0-9-]+$/.test(name)) throw new Error("R2 EU configuration is invalid");
  const client = new AwsClient({ service: "s3", region: "auto", accessKeyId, secretAccessKey });
  const send: Fetcher = (input, init) => client.fetch(input, init);
  const base = `${endpoint}/${name}`;
  const url = (key: string) => {
    if (typeof key !== "string" || !key || key.length > 1024 || key.includes("\0") || key.split("/").some((part) => part === "." || part === "..")) throw new Error("Invalid object key");
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  };

  async function head(key: string) {
    const response = await send(url(key), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Private storage metadata failed (${response.status})`);
    return info(key, response.headers);
  }

  async function get(key: string, options?: { onlyIf?: { etagMatches?: string } }) {
    const match = options?.onlyIf?.etagMatches;
    const response = await send(url(key), { method: "GET", headers: match ? { "If-Match": `"${unquote(match)}"` } : {} });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    // Like R2: a failed precondition returns the object's metadata without a body.
    if (response.status === 412) { await response.body?.cancel(); return head(key); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Private storage download failed (${response.status})`); }
    const body = response.body!;
    return { ...info(key, response.headers), body, arrayBuffer: () => response.arrayBuffer(), text: () => response.text() };
  }

  async function put(key: string, value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
    const headers: Record<string, string> = {};
    if (options?.httpMetadata?.contentType) headers["Content-Type"] = options.httpMetadata.contentType;
    for (const [field, text] of Object.entries(options?.customMetadata || {})) headers[`x-amz-meta-${field.toLowerCase()}`] = text;
    const response = await send(url(key), { method: "PUT", headers, body: value as BodyInit });
    if (!response.ok) throw new Error(`Private storage upload failed (${response.status})`);
    const etag = unquote(response.headers.get("etag") || "");
    const size = typeof value === "string" ? new TextEncoder().encode(value).byteLength : value instanceof ArrayBuffer ? value.byteLength : ArrayBuffer.isView(value) ? value.byteLength : value instanceof Blob ? value.size : 0;
    return { key, size, etag, httpEtag: `"${etag}"`, uploaded: new Date(), httpMetadata: options?.httpMetadata || {}, customMetadata: options?.customMetadata || {} };
  }

  async function remove(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const response = await send(url(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(`Private storage delete failed (${response.status})`);
    }
  }

  async function list(options?: { limit?: number; cursor?: string; prefix?: string }) {
    const query = new URL(base);
    query.searchParams.set("list-type", "2");
    query.searchParams.set("max-keys", String(Math.max(1, Math.min(1000, options?.limit || 1000))));
    if (options?.prefix) query.searchParams.set("prefix", options.prefix);
    if (options?.cursor) query.searchParams.set("continuation-token", options.cursor);
    const response = await send(query.toString());
    if (!response.ok) throw new Error(`Private storage listing failed (${response.status})`);
    const xml = await response.text();
    if (xml.length > 5_000_000 || !xml.includes("<ListBucketResult") || xml.includes("<!DOCTYPE")) throw new Error("Invalid storage listing");
    const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) => {
      const etag = unquote(tag(match[1], "ETag") || "");
      return { key: tag(match[1], "Key") || "", size: Number(tag(match[1], "Size") || 0), etag, httpEtag: `"${etag}"`, uploaded: new Date(tag(match[1], "LastModified") || 0) };
    });
    const truncated = tag(xml, "IsTruncated") === "true", next = tag(xml, "NextContinuationToken");
    if (truncated && !next) throw new Error("Incomplete storage listing");
    return { objects, truncated, ...(truncated ? { cursor: next! } : {}), delimitedPrefixes: [] as string[] };
  }

  return { head, get, put, delete: remove, list };
}

// R2Bucket-compatible view for lib/server.ts bucket(); null when the S3 settings are missing.
export function privateBucket() {
  return s3PrivateBucket(env as unknown as PrivateBucketSettings) as unknown as R2Bucket | null;
}
