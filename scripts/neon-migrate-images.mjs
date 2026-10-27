import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const secrets = Object.fromEntries((await readFile("work/integration-secrets.env", "utf8"))
  .split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")]));
const sql = neon(secrets.DATABASE_URL);
const s3 = new S3Client({ region: "auto", endpoint: secrets.R2_ENDPOINT, forcePathStyle: true,
  credentials: { accessKeyId: secrets.R2_ACCESS_KEY_ID, secretAccessKey: secrets.R2_SECRET_ACCESS_KEY } });
let stage = "query";
try {
  const listings = await sql.query("SELECT id,owner_id,images,created_at FROM listings", []);
  let copied = 0;
  for (const listing of listings) {
    const images = JSON.parse(listing.images || "[]");
    for (let index = 0; index < images.length; index++) {
      const url = images[index];
      if (!/^\/api\/media\/listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(url)) throw new Error("Unknown image URL");
      const key = url.slice("/api/media/".length);
      const origin = "https://exxel-estate.blue-grape-8839.chatgpt.site";
      stage = "legacy-download";
      const response = await fetch(origin + url);
      if (!response.ok) throw new Error("Legacy image unavailable");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "image/jpeg";
      stage = "r2-put";
      await s3.send(new PutObjectCommand({ Bucket: secrets.R2_BUCKET_NAME, Key: key, Body: bytes, ContentType: contentType }));
      stage = "r2-head";
      const head = await s3.send(new HeadObjectCommand({ Bucket: secrets.R2_BUCKET_NAME, Key: key }));
      if (Number(head.ContentLength) !== bytes.length) throw new Error("R2 size mismatch");
      stage = "record";
      await sql.query("INSERT INTO property_images(id,property_id,storage_provider,bucket,object_key,content_type,byte_size,sort_order,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(object_key) DO NOTHING",
        [crypto.randomUUID(), listing.id, "r2", secrets.R2_BUCKET_NAME, key, contentType, bytes.length, index, listing.created_at]);
      copied++;
    }
  }
  process.stdout.write(`Migrated and verified ${copied} photo(s).\n`);
} catch (error) {
  const safeMessage = String(error.message || "").replaceAll(secrets.R2_ACCESS_KEY_ID, "[redacted]").replaceAll(secrets.R2_SECRET_ACCESS_KEY, "[redacted]").replaceAll(secrets.DATABASE_URL, "[redacted]").replaceAll(secrets.R2_ENDPOINT, "[endpoint]").slice(0, 240);
  process.stderr.write(`Image migration failed at ${stage} (${error.code || error.name || "unknown"}, HTTP ${error.$metadata?.httpStatusCode || "none"}): ${safeMessage}\n`);
  process.exitCode = 1;
}
