// Copies the old Sites BUCKET (office documents, tour captures, legacy images)
// into the owner's own private R2 bucket through the read-only backup reader.
// Safe to re-run: files already downloaded with the same size are reused.
//
// Usage (in the project folder, after `wrangler login`):
//   node scripts/migrate-private-media.mjs [--dry-run]
// The old Site's BACKUP_READ_TOKEN is asked for with hidden input unless it is
// already in the environment. Uploads use the logged-in Wrangler session.
// Optional environment: OLD_SITE_URL, NEW_SITE_URL, NEW_R2_BUCKET, DUMP_DIR.
import { spawnSync } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const dryRun = process.argv.includes("--dry-run");
const oldSite = (process.env.OLD_SITE_URL || "https://exxel-estate.blue-grape-8839.chatgpt.site").replace(/\/$/, "");
const newSite = (process.env.NEW_SITE_URL || "https://exxel-estate.aliikocr10.workers.dev").replace(/\/$/, "");
const newBucket = process.env.NEW_R2_BUCKET || "exxel-estate-private";
const dumpDir = path.resolve(process.env.DUMP_DIR || "work/private-media");
const wrangler = path.resolve("node_modules/wrangler/bin/wrangler.js");

function askHidden(question) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  input._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
  return new Promise((resolve) => input.question(question, (answer) => {
    input.close();
    process.stdout.write("\n");
    resolve(answer.trim());
  }));
}
const token = process.env.BACKUP_READ_TOKEN || await askHidden("Old Site BACKUP_READ_TOKEN: ");
if (token.length < 48) throw new Error("BACKUP_READ_TOKEN must be at least 48 characters.");

const reader = (site, params) => {
  const url = new URL("/api/backup-storage", site);
  for (const [key, value] of Object.entries({ source: "private-media", ...params })) {
    if (value) url.searchParams.set(key, value);
  }
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
};
const readJson = async (site, params) => {
  const response = await reader(site, params);
  if (!response.ok) throw new Error(`Backup reader ${params.mode} on ${site} failed (${response.status}) ${params.key || ""}`);
  return response.json();
};
const listAll = async (site) => {
  const objects = [];
  for (let cursor = null; ;) {
    const page = await readJson(site, { mode: "list", cursor });
    objects.push(...page.objects);
    if (!page.cursor) return objects;
    cursor = page.cursor;
  }
};
const localPath = (key) => path.join(dumpDir, ...key.split("/"));
const sizeOf = async (file) => (await stat(file).catch(() => null))?.size ?? -1;

const objects = await listAll(oldSite);
const totalBytes = objects.reduce((sum, item) => sum + item.size, 0);
console.log(`Old Sites bucket: ${objects.length} objects, ${(totalBytes / 1048576).toFixed(1)} MB`);
const prefixes = objects.reduce((all, item) => {
  const prefix = item.key.split("/")[0];
  all[prefix] = (all[prefix] || 0) + 1;
  return all;
}, {});
for (const [prefix, count] of Object.entries(prefixes)) console.log(`  ${prefix}/: ${count}`);
await mkdir(dumpDir, { recursive: true });
await writeFile(path.join(dumpDir, "manifest.json"), JSON.stringify(objects, null, 2));
if (dryRun) process.exit(0);

const failures = [];
for (const [index, item] of objects.entries()) {
  try {
    const file = localPath(item.key);
    if (await sizeOf(file) !== item.size) {
      const response = await reader(oldSite, { mode: "get", key: item.key });
      if (!response.ok) throw new Error(`download ${response.status}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      if (await sizeOf(file) !== item.size) throw new Error("downloaded size mismatch");
    }
    const { metadata } = await readJson(oldSite, { mode: "head", key: item.key });
    const upload = spawnSync(process.execPath, [
      wrangler, "r2", "object", "put", `${newBucket}/${item.key}`, "--file", file,
      "--content-type", metadata?.ContentType || "application/octet-stream",
      "--jurisdiction", "eu", "--remote",
    ], { encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
    if (upload.status !== 0) throw new Error(`upload failed: ${(upload.stderr || upload.stdout).trim().split("\n").pop()}`);
    console.log(`  ${index + 1}/${objects.length} ${item.key}`);
  } catch (cause) {
    failures.push({ key: item.key, error: String(cause.message || cause) });
  }
}
if (failures.length) {
  await writeFile(path.join(dumpDir, "failures.json"), JSON.stringify(failures, null, 2));
  console.log(`Failed ${failures.length}; see ${path.join(dumpDir, "failures.json")} and re-run.`);
  process.exit(1);
}

// Confirm through the new Site's reader when it has the same token configured.
const check = await reader(newSite, { mode: "list" });
if (check.status === 401) {
  console.log(`Uploaded ${objects.length}. New Site has no matching BACKUP_READ_TOKEN, so the final listing check was skipped.`);
  process.exit(0);
}
const copied = new Map((await listAll(newSite)).map((item) => [item.key, item.size]));
const missing = objects.filter((item) => copied.get(item.key) !== item.size);
console.log(`Verified on new Site: ${objects.length - missing.length}/${objects.length} objects with matching size.`);
if (missing.length) {
  console.log("Missing or different:", missing.map((item) => item.key).join(", "));
  process.exit(1);
}
