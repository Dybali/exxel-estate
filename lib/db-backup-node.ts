import { spawn as nodeSpawn } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";
import { databaseDriver } from "./pg-d1";
// Through the alias: in the Node build this is lib/postgres-driver-node.ts.
import { postgresDriver } from "@/lib/postgres-driver";
import type { BackupReport, PrivateMediaMissing, PrivateMediaReport } from "./db-backup";

// Daily encrypted offsite copy of the container's PostgreSQL database (docs/backups-monitoring.md).
// Node build only: next.config.ts aliases "@/lib/db-backup" here; Cloudflare sees the null slot
// lib/db-backup.ts. Steps: pg_dump (custom format) to a temp file -> pg_restore --list must succeed
// with enough TABLE DATA entries -> AES-256-GCM encryption while hashing the plaintext -> upload to
// R2 (multipart for large files) + JSON manifest -> keep the 30 newest backups under mittwald-db/.
// Never throws: every failure becomes { status: "failed" } in the report.
//
// File format (.dump.enc), version 1:
//   bytes 0-7    ASCII magic "EM24DUMP"
//   byte  8      format version (1)
//   bytes 9-20   random 12-byte AES-GCM IV
//   bytes 21..   AES-256-GCM ciphertext of the pg_dump custom-format file; the 21 header bytes are
//                the additional authenticated data, so the header cannot be altered either
//   last 16      GCM authentication tag
// The key is BACKUP_ENCRYPTION_KEY: 32 random bytes, base64. scripts/backup-restore.mjs decrypts.

export const BACKUP_MAGIC = "EM24DUMP";
export const BACKUP_VERSION = 1;
export const HEADER_BYTES = 21;
export const TAG_BYTES = 16;
export const BACKUP_PREFIX = "mittwald-db/";
export const DEFAULT_BACKUP_BUCKET = "estatemarket24-backups";
export const KEEP_BACKUPS = 30;
export const MIN_TABLES = 30;
export const PART_BYTES = 16 * 1024 * 1024;
const PG_BIN_DIR = "/usr/libexec/postgresql18";
const BACKUP_NAME = /^mittwald-db\/db-(\d{4}-\d\d-\d\dT\d{6}Z)\.(dump\.enc|json)$/;

export type BackupSettings = {
  DATABASE_URL?: string; DATABASE_DRIVER?: string;
  BACKUP_ENCRYPTION_KEY?: string; BACKUP_MIN_TABLES?: string; PG_BIN_DIR?: string;
  R2_ENDPOINT?: string; R2_ACCESS_KEY_ID?: string; R2_SECRET_ACCESS_KEY?: string;
  R2_BACKUP_BUCKET?: string; R2_PRIVATE_BUCKET_NAME?: string; APP_COMMIT?: string; PATH?: string;
};
type ChildLike = {
  stdout: NodeJS.ReadableStream | null; stderr: NodeJS.ReadableStream | null;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: (code: number | null) => void): unknown;
  kill(signal?: NodeJS.Signals): unknown;
};
export type BackupSpawn = (command: string, args: string[], options: { env: Record<string, string>; stdio: ["ignore", "pipe", "pipe"]; windowsHide: boolean }) => ChildLike;
type Fetcher = (request: Request) => Promise<Response>;
interface Statement { all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type BackupDatabase = { prepare(sql: string): Statement };
export type BackupDeps = { spawn?: BackupSpawn; fetch?: Fetcher; database?: BackupDatabase; now?: () => Date; tmpRoot?: string; exists?: (file: string) => boolean };

// --- key and file format ------------------------------------------------------------------------

export function parseBackupKey(value: string | undefined) {
  const text = (value || "").trim();
  if (!text) throw new Error("BACKUP_ENCRYPTION_KEY is not set");
  if (!/^[A-Za-z0-9+/]{43}=?$/.test(text)) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  const key = Buffer.from(text, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  return key;
}

export function backupHeader(iv: Uint8Array) {
  if (iv.length !== 12) throw new Error("IV must be 12 bytes");
  return Buffer.concat([Buffer.from(BACKUP_MAGIC, "ascii"), Buffer.from([BACKUP_VERSION]), Buffer.from(iv)]);
}

function meter() {
  const hash = createHash("sha256");
  let bytes = 0;
  const stream = new Transform({ transform(chunk: Buffer, _encoding, done) { bytes += chunk.length; hash.update(chunk); done(null, chunk); } });
  return { stream, result: () => ({ bytes, sha256: hash.digest("hex") }) };
}

// Streams input -> output as header + AES-256-GCM ciphertext + tag; hashes plaintext and ciphertext.
export async function encryptFile(input: string, output: string, key: Buffer, iv: Buffer = randomBytes(12)) {
  const header = backupHeader(iv);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const plain = meter(), sealed = meter();
  await pipeline(createReadStream(input), plain.stream, cipher, async function* (source: AsyncIterable<Buffer>) {
    yield header;
    for await (const chunk of source) yield chunk;
    yield cipher.getAuthTag();
  }, sealed.stream, createWriteStream(output));
  const p = plain.result(), s = sealed.result();
  return { bytes: p.bytes, sha256: p.sha256, encryptedBytes: s.bytes, encryptedSha256: s.sha256 };
}

// --- pg_dump / pg_restore -----------------------------------------------------------------------

export function pgBinary(name: "pg_dump" | "pg_restore", settings: BackupSettings, exists: (file: string) => boolean = existsSync) {
  const dir = settings.PG_BIN_DIR || (exists(path.posix.join(PG_BIN_DIR, name)) ? PG_BIN_DIR : "");
  return dir ? path.posix.join(dir, name) : name;
}

// Connection settings as libpq environment variables: the password never appears in argv or logs,
// and the child gets nothing else from the container environment (no other secrets).
export function pgConnectionEnv(url: string, base: { PATH?: string } = {}) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("DATABASE_URL is not a valid URL"); }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error("DATABASE_URL is not a PostgreSQL URL");
  const env: Record<string, string> = { PATH: base.PATH || "/usr/local/bin:/usr/bin:/bin", PGAPPNAME: "exxel-backup", PGCONNECT_TIMEOUT: "15" };
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (host) env.PGHOST = decodeURIComponent(host);
  if (parsed.port) env.PGPORT = parsed.port;
  if (parsed.username) env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password) env.PGPASSWORD = decodeURIComponent(parsed.password);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database) env.PGDATABASE = database;
  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode && /^(disable|allow|prefer|require|verify-ca|verify-full)$/.test(sslmode)) env.PGSSLMODE = sslmode;
  return env;
}

export function pgDumpArgs(file: string) {
  return ["--format=custom", "--no-owner", "--no-privileges", "--no-password", "--file", file];
}

export function countTableData(list: string) {
  return list.split(/\r?\n/).filter((line) => !line.startsWith(";") && / TABLE DATA /.test(line)).length;
}

function runTool(spawn: BackupSpawn, command: string, args: string[], env: Record<string, string>, timeoutMs: number) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve, reject) => {
    let child: ChildLike;
    try { child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }); } catch (cause) { reject(cause); return; }
    let stdout = "", stderr = "", timedOut = false;
    child.stdout?.on("data", (chunk: Buffer) => { if (stdout.length < 20_000_000) stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4000); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

// Error text from the PostgreSQL tools: last lines only, and never anything that looks like a URL
// with credentials (pg_dump does not print the password, this is a second line of defence).
const toolError = (stderr: string) => stderr.replace(/postgres(ql)?:\/\/\S+/g, "postgres://***").trim().split(/\r?\n/).slice(-3).join(" ").slice(0, 300);

// --- R2 (S3 API) --------------------------------------------------------------------------------

type S3Settings = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };
const xmlText = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => { const match = xml.match(new RegExp("<" + name + ">([\\s\\S]*?)</" + name + ">")); return match ? xmlText(match[1]) : null; };
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const drain = (response: Response) => response.body?.cancel().catch(() => {});

export function s3Bucket(settings: S3Settings, fetcher: Fetcher = (request) => fetch(request)) {
  if (!/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(settings.endpoint) || !/^[a-z0-9-]+$/.test(settings.bucket)) throw new Error("R2 EU configuration is invalid");
  const client = new AwsClient({ service: "s3", region: "auto", accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey, retries: 0 });
  const base = `${settings.endpoint}/${settings.bucket}`;
  const url = (key: string, query = "") => {
    if (!key || key.length > 1024 || key.split("/").some((part) => part === "." || part === "..")) throw new Error("Invalid object key");
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}${query}`;
  };
  // Every body here is a Buffer or string, so a request can be signed and sent again on 5xx/network errors.
  // R2 answered 411 (Length Required) to the backup upload on Mittwald, so every request with a body
  // states its exact Content-Length, as the video uploads (lib/video-storage.ts) already do.
  async function send(input: string, init: RequestInit = {}) {
    if (init.body !== undefined && init.body !== null) {
      const body = init.body as Uint8Array | string;
      const length = typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
      init = { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "Content-Length": String(length) } };
    }
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetcher(await client.sign(input, init));
        if (response.status < 500 || attempt >= 3) return response;
        await drain(response);
      } catch (cause) { if (attempt >= 3) throw cause; }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  const fail = async (response: Response, what: string) => { await drain(response); return new Error(`${what} failed (${response.status})`); };
  return {
    async put(key: string, body: Uint8Array | string, headers: Record<string, string> = {}) {
      const response = await send(url(key), { method: "PUT", headers, body: body as BodyInit });
      if (!response.ok) throw await fail(response, "R2 upload");
      await drain(response);
    },
    async head(key: string) {
      const response = await send(url(key), { method: "HEAD" });
      await drain(response);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 metadata failed (${response.status})`);
      return { size: Number(response.headers.get("content-length") || 0), sha256: response.headers.get("x-amz-meta-sha256") };
    },
    async delete(key: string) {
      const response = await send(url(key), { method: "DELETE" });
      await drain(response);
      if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed (${response.status})`);
    },
    async list(prefix: string) {
      const keys: string[] = [];
      let token = "";
      for (let page = 0; page < 100; page++) {
        const query = new URL(base);
        query.searchParams.set("list-type", "2");
        query.searchParams.set("prefix", prefix);
        if (token) query.searchParams.set("continuation-token", token);
        const response = await send(query.toString());
        if (!response.ok) throw await fail(response, "R2 listing");
        const xml = await response.text();
        if (!xml.includes("<ListBucketResult")) throw new Error("Invalid R2 listing");
        for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) keys.push(tag(match[1], "Key") || "");
        if (tag(xml, "IsTruncated") !== "true") return keys;
        token = tag(xml, "NextContinuationToken") || "";
        if (!token) throw new Error("Incomplete R2 listing");
      }
      throw new Error("R2 listing too long");
    },
    async createUpload(key: string, headers: Record<string, string>) {
      const response = await send(url(key, "?uploads"), { method: "POST", headers });
      if (!response.ok) throw await fail(response, "R2 multipart start");
      const id = tag(await response.text(), "UploadId");
      if (!id) throw new Error("R2 multipart start returned no upload id");
      return id;
    },
    async uploadPart(key: string, uploadId: string, part: number, body: Uint8Array) {
      const response = await send(url(key, `?partNumber=${part}&uploadId=${encodeURIComponent(uploadId)}`), { method: "PUT", body: body as BodyInit });
      if (!response.ok) throw await fail(response, "R2 part upload");
      await drain(response);
      const etag = response.headers.get("etag");
      if (!etag) throw new Error("R2 part upload returned no ETag");
      return etag;
    },
    async completeUpload(key: string, uploadId: string, etags: string[]) {
      const body = `<CompleteMultipartUpload>${etags.map((etag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
      const response = await send(url(key, `?uploadId=${encodeURIComponent(uploadId)}`), { method: "POST", headers: { "Content-Type": "application/xml" }, body });
      const text = await response.text();
      // S3 can answer 200 and still report an error in the body.
      if (!response.ok || text.includes("<Error>")) throw new Error(`R2 multipart completion failed (${response.status})`);
    },
    async abortUpload(key: string, uploadId: string) {
      const response = await send(url(key, `?uploadId=${encodeURIComponent(uploadId)}`), { method: "DELETE" });
      await drain(response);
    },
  };
}
export type BackupBucket = ReturnType<typeof s3Bucket>;

// Single PUT up to one part size, otherwise a multipart upload read part by part from disk.
export async function uploadFile(store: BackupBucket, key: string, file: string, size: number, headers: Record<string, string>, partBytes = PART_BYTES) {
  const handle = await open(file, "r");
  try {
    const read = async (offset: number, length: number) => {
      const buffer = Buffer.alloc(length);
      let done = 0;
      while (done < length) { const { bytesRead } = await handle.read(buffer, done, length - done, offset + done); if (!bytesRead) throw new Error("Backup file shrank during upload"); done += bytesRead; }
      return buffer;
    };
    if (size <= partBytes) { await store.put(key, await read(0, size), headers); return { parts: 1 }; }
    const uploadId = await store.createUpload(key, headers);
    try {
      const etags: string[] = [];
      for (let offset = 0; offset < size; offset += partBytes) etags.push(await store.uploadPart(key, uploadId, etags.length + 1, await read(offset, Math.min(partBytes, size - offset))));
      await store.completeUpload(key, uploadId, etags);
      return { parts: etags.length };
    } catch (cause) {
      await store.abortUpload(key, uploadId).catch(() => {});
      throw cause;
    }
  } finally {
    await handle.close();
  }
}

// --- retention ----------------------------------------------------------------------------------

// Keeps the `keep` newest complete backups (data + manifest) under mittwald-db/. Deletes every
// backup object older than the oldest kept one (including incomplete leftovers); never touches keys
// that do not match the backup name pattern, so other prefixes (db/, ...) are safe.
export function retentionPlan(keys: string[], keep = KEEP_BACKUPS) {
  const stamps = new Map<string, string[]>();
  const complete = new Map<string, Set<string>>();
  for (const key of keys) {
    const match = BACKUP_NAME.exec(key);
    if (!match) continue;
    stamps.set(match[1], [...(stamps.get(match[1]) || []), key]);
    complete.set(match[1], (complete.get(match[1]) || new Set()).add(match[2]));
  }
  const kept = [...complete].filter(([, kinds]) => kinds.has("dump.enc") && kinds.has("json")).map(([stamp]) => stamp).sort().reverse();
  if (kept.length <= keep) return { keep: kept, delete: [] as string[] };
  const oldestKept = kept[keep - 1];
  return { keep: kept.slice(0, keep), delete: [...stamps].filter(([stamp]) => stamp < oldestKept).flatMap(([, list]) => list).sort() };
}

// --- private media check (warning only) ---------------------------------------------------------

const keyHash = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 16);

// Rows that reference objects in the private bucket: office verification documents and tour capture
// files. Reports missing objects by table, row id (document_id / job id, never names) and a hash of
// the key, because keys contain user ids.
export async function checkPrivateMedia(database: BackupDatabase, exists: (key: string) => Promise<boolean>, options: { sample?: number; limit?: number; concurrency?: number } = {}): Promise<PrivateMediaReport> {
  const refs: { table: string; id: string; state: string; key: string }[] = [];
  const notes: string[] = [];
  try {
    const rows = (await database.prepare("SELECT document_id, object_key, state FROM office_verifications").all<{ document_id: string; object_key: string; state: string }>()).results;
    for (const row of rows) if (row.object_key) refs.push({ table: "office_verifications", id: String(row.document_id), state: String(row.state), key: row.object_key });
  } catch { notes.push("office_verifications not readable"); }
  try {
    const rows = (await database.prepare("SELECT id, state, result_key, files FROM tour_capture_jobs").all<{ id: string; state: string; result_key: string | null; files: string }>()).results;
    for (const row of rows) {
      if (["ready", "accepted"].includes(row.state) && row.result_key) refs.push({ table: "tour_capture_jobs", id: String(row.id), state: row.state, key: row.result_key });
      if (["uploading", "queued", "processing"].includes(row.state)) {
        let files: unknown = [];
        try { files = JSON.parse(row.files || "[]"); } catch { notes.push("tour_capture_jobs has unreadable file lists"); }
        if (Array.isArray(files)) for (const key of files) if (typeof key === "string") refs.push({ table: "tour_capture_jobs", id: String(row.id), state: row.state, key });
      }
    }
  } catch { notes.push("tour_capture_jobs not readable"); }
  const limit = options.limit ?? 5000, cap = options.sample ?? 20;
  if (refs.length > limit) notes.push(`only the first ${limit} of ${refs.length} references checked`);
  const todo = refs.slice(0, limit), missing: PrivateMediaMissing[] = [];
  let errors = 0, next = 0, missingCount = 0;
  const worker = async () => {
    while (next < todo.length) {
      const ref = todo[next++];
      try {
        if (!await exists(ref.key)) { missingCount++; if (missing.length < cap) missing.push({ table: ref.table, id: ref.id, state: ref.state, keyHash: keyHash(ref.key) }); }
      } catch { errors++; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 6, todo.length)) }, worker));
  missing.sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id));
  return { checked: todo.length, missing: missingCount, errors, sample: missing, ...(notes.length ? { note: notes.join("; ") } : {}) };
}

// --- the job ------------------------------------------------------------------------------------

// UTC, sortable as text: 2026-11-05T060000Z.
export const backupStamp = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");

let running = false;

export async function runDatabaseBackup(settings: BackupSettings = process.env as BackupSettings, deps: BackupDeps = {}): Promise<BackupReport> {
  const started = Date.now();
  const done = (report: Omit<BackupReport, "ms">): BackupReport => ({ ...report, ms: Date.now() - started });
  const url = settings.DATABASE_URL;
  if (!url) return done({ status: "skipped", reason: "no database configured (DATABASE_URL is empty)" });
  if (databaseDriver(url, settings.DATABASE_DRIVER, true) !== "postgres") return done({ status: "skipped", reason: "the database is not the container's TCP PostgreSQL (e.g. Neon); this backup covers the Mittwald database only" });
  if (running) return done({ status: "skipped", reason: "another backup is already running in this container" });
  running = true;
  let stage = "configuration", tempDir = "";
  const warnings: string[] = [];
  try {
    const key = parseBackupKey(settings.BACKUP_ENCRYPTION_KEY);
    const { R2_ENDPOINT: endpoint, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = settings;
    if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required");
    const store = s3Bucket({ endpoint, accessKeyId, secretAccessKey, bucket: settings.R2_BACKUP_BUCKET || DEFAULT_BACKUP_BUCKET }, deps.fetch);
    const minTables = Math.max(1, Number(settings.BACKUP_MIN_TABLES) || MIN_TABLES);
    const spawn = deps.spawn ?? (nodeSpawn as unknown as BackupSpawn);
    const pgEnv = pgConnectionEnv(url, { PATH: settings.PATH });
    const stamp = backupStamp(deps.now?.() ?? new Date());
    const dataKey = `${BACKUP_PREFIX}db-${stamp}.dump.enc`, manifestKey = `${BACKUP_PREFIX}db-${stamp}.json`;

    stage = "dump";
    tempDir = await mkdtemp(path.join(deps.tmpRoot ?? tmpdir(), "em24-backup-"));
    const dumpFile = path.join(tempDir, "db.dump"), encFile = path.join(tempDir, "db.dump.enc");
    const dump = await runTool(spawn, pgBinary("pg_dump", settings, deps.exists), pgDumpArgs(dumpFile), pgEnv, 45 * 60_000);
    if (dump.timedOut) throw new Error("pg_dump timed out");
    if (dump.code !== 0) throw new Error(`pg_dump failed (exit ${dump.code}): ${toolError(dump.stderr)}`);

    stage = "verify";
    const list = await runTool(spawn, pgBinary("pg_restore", settings, deps.exists), ["--list", dumpFile], { PATH: pgEnv.PATH }, 5 * 60_000);
    if (list.timedOut || list.code !== 0) throw new Error(`pg_restore --list failed: ${toolError(list.stderr)}`);
    const tables = countTableData(list.stdout);
    if (tables < minTables) throw new Error(`dump looks incomplete: ${tables} TABLE DATA entries (minimum ${minTables})`);

    stage = "encrypt";
    const sealed = await encryptFile(dumpFile, encFile, key);
    if (sealed.bytes !== (await stat(dumpFile)).size) throw new Error("encrypted size does not match the dump");
    await rm(dumpFile, { force: true });

    stage = "upload";
    const headers = { "Content-Type": "application/octet-stream", "x-amz-meta-sha256": sealed.sha256, "x-amz-meta-format": "em24-aes-256-gcm-v1", "x-amz-meta-tables": String(tables) };
    await uploadFile(store, dataKey, encFile, sealed.encryptedBytes, headers);
    const uploaded = await store.head(dataKey);
    if (!uploaded || uploaded.size !== sealed.encryptedBytes) throw new Error("uploaded backup size does not match");
    const manifest = {
      format: "em24-db-backup", version: BACKUP_VERSION, encryption: "AES-256-GCM", stamp, key: dataKey, createdAt: new Date().toISOString(),
      bytes: sealed.bytes, sha256: sealed.sha256, encryptedBytes: sealed.encryptedBytes, encryptedSha256: sealed.encryptedSha256,
      tables, pgDump: "custom --no-owner --no-privileges", appCommit: settings.APP_COMMIT || null,
    };
    await store.put(manifestKey, JSON.stringify(manifest, null, 2), { "Content-Type": "application/json" });
    console.info("[backup] uploaded", JSON.stringify({ key: dataKey, bytes: sealed.bytes, encryptedBytes: sealed.encryptedBytes, tables }));

    // From here on the backup exists; later problems are warnings only.
    stage = "retention";
    let retention: BackupReport["retention"];
    try {
      const plan = retentionPlan(await store.list(BACKUP_PREFIX));
      for (const old of plan.delete) await store.delete(old);
      retention = { kept: plan.keep.length, deleted: plan.delete.length };
    } catch (cause) { warnings.push(`retention: ${(cause as Error).message}`); }

    stage = "private-media";
    let privateMedia: PrivateMediaReport | undefined;
    try {
      const database = deps.database ?? (postgresDriver ? postgresDriver(url) as unknown as BackupDatabase : null);
      if (!database) throw new Error("no database driver");
      const privateStore = s3Bucket({ endpoint, accessKeyId, secretAccessKey, bucket: settings.R2_PRIVATE_BUCKET_NAME || "exxel-estate-private" }, deps.fetch);
      privateMedia = await checkPrivateMedia(database, async (objectKey) => (await privateStore.head(objectKey)) !== null);
      if (privateMedia.missing) {
        warnings.push(`private media: ${privateMedia.missing} referenced object(s) missing in the private bucket`);
        console.warn("[backup] private media missing", JSON.stringify(privateMedia.sample));
      }
    } catch (cause) { warnings.push(`private media check: ${(cause as Error).message}`); }

    return done({ status: "ok", key: dataKey, manifest: manifestKey, bytes: sealed.bytes, encryptedBytes: sealed.encryptedBytes, tables, sha256: sealed.sha256, retention, privateMedia, ...(warnings.length ? { warnings } : {}) });
  } catch (cause) {
    const error = String((cause as Error)?.message || cause).slice(0, 400);
    console.error("[backup] failed", JSON.stringify({ stage, error }));
    return done({ status: "failed", stage, error });
  } finally {
    running = false;
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
