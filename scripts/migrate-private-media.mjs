// Copies the old Sites BUCKET (office documents, tour captures, legacy images)
// into the owner's own private R2 bucket through the read-only backup reader.
// Safe to re-run: objects already copied with the same size are skipped.
//
// Required environment (never commit these values):
//   OLD_SITE_URL            e.g. https://exxel-estate.blue-grape-8839.chatgpt.site
//   BACKUP_READ_TOKEN       the old Site's backup reader secret
//   NEW_R2_ENDPOINT         https://<account-id>.eu.r2.cloudflarestorage.com
//   NEW_R2_ACCESS_KEY_ID, NEW_R2_SECRET_ACCESS_KEY  (Object Read & Write on the new bucket)
// Optional: NEW_R2_BUCKET (default exxel-estate-private), DUMP_DIR (default work/private-media)
// Usage: node scripts/migrate-private-media.mjs [--dry-run]
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const dryRun = process.argv.includes("--dry-run");
const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const oldSite = need("OLD_SITE_URL").replace(/\/$/, "");
const token = need("BACKUP_READ_TOKEN");
const dumpDir = path.resolve(process.env.DUMP_DIR || "work/private-media");
const newBucket = process.env.NEW_R2_BUCKET || "exxel-estate-private";
const newEndpoint = dryRun ? "" : need("NEW_R2_ENDPOINT").replace(/\/$/, "");
if (!dryRun && !/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(newEndpoint)) {
  throw new Error("NEW_R2_ENDPOINT must be the EU R2 S3 endpoint.");
}
const r2 = dryRun ? null : new AwsClient({
  service: "s3", region: "auto",
  accessKeyId: need("NEW_R2_ACCESS_KEY_ID"), secretAccessKey: need("NEW_R2_SECRET_ACCESS_KEY"),
});

const reader = (params) => {
  const url = new URL("/api/backup-storage", oldSite);
  for (const [key, value] of Object.entries({ source: "private-media", ...params })) {
    if (value) url.searchParams.set(key, value);
  }
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
};
const readJson = async (params) => {
  const response = await reader(params);
  if (!response.ok) throw new Error(`Backup reader ${params.mode} failed (${response.status}) ${params.key || ""}`);
  return response.json();
};
const localPath = (key) => path.join(dumpDir, ...key.split("/"));
const objectUrl = (key) => `${newEndpoint}/${newBucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
const sizeOf = async (file) => (await stat(file).catch(() => null))?.size ?? -1;

const objects = [];
for (let cursor = null; ;) {
  const page = await readJson({ mode: "list", cursor });
  objects.push(...page.objects);
  if (!page.cursor) break;
  cursor = page.cursor;
}
const totalBytes = objects.reduce((sum, item) => sum + item.size, 0);
console.log(`Old Sites bucket: ${objects.length} objects, ${(totalBytes / 1048576).toFixed(1)} MB`);
const prefixes = Object.entries(objects.reduce((all, item) => {
  const prefix = item.key.split("/")[0];
  all[prefix] = (all[prefix] || 0) + 1;
  return all;
}, {}));
for (const [prefix, count] of prefixes) console.log(`  ${prefix}/: ${count}`);
await mkdir(dumpDir, { recursive: true });
await writeFile(path.join(dumpDir, "manifest.json"), JSON.stringify(objects, null, 2));
if (dryRun) process.exit(0);

const failures = [];
let copied = 0, skipped = 0;
for (const [index, item] of objects.entries()) {
  try {
    const existing = await r2.fetch(objectUrl(item.key), { method: "HEAD" });
    if (existing.ok && Number(existing.headers.get("content-length")) === item.size) {
      skipped++;
      continue;
    }
    const file = localPath(item.key);
    if (await sizeOf(file) !== item.size) {
      const response = await reader({ mode: "get", key: item.key });
      if (!response.ok) throw new Error(`download ${response.status}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      if (await sizeOf(file) !== item.size) throw new Error("downloaded size mismatch");
    }
    const { metadata } = await readJson({ mode: "head", key: item.key });
    const headers = { "Content-Type": metadata?.ContentType || "application/octet-stream" };
    for (const [name, value] of Object.entries(metadata?.Metadata || {})) headers[`x-amz-meta-${name}`] = String(value);
    const upload = await r2.fetch(objectUrl(item.key), { method: "PUT", headers, body: await readFile(file) });
    if (!upload.ok) throw new Error(`upload ${upload.status}`);
    const check = await r2.fetch(objectUrl(item.key), { method: "HEAD" });
    if (Number(check.headers.get("content-length")) !== item.size) throw new Error("uploaded size mismatch");
    copied++;
  } catch (cause) {
    failures.push({ key: item.key, error: String(cause.message || cause) });
  }
  if ((index + 1) % 50 === 0) console.log(`  ${index + 1}/${objects.length}`);
}
console.log(`Copied ${copied}, already present ${skipped}, failed ${failures.length}`);
if (failures.length) {
  await writeFile(path.join(dumpDir, "failures.json"), JSON.stringify(failures, null, 2));
  console.log(`Failures written to ${path.join(dumpDir, "failures.json")}; re-run to retry.`);
  process.exit(1);
}
