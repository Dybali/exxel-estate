import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const secrets = Object.fromEntries((await readFile("work/integration-secrets.env", "utf8"))
  .split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")]));
const sql = neon(secrets.DATABASE_URL);
const user = (await sql.query("SELECT id FROM users WHERE role IN ('admin','individual','agent') ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1", []))[0];
if (!user) throw new Error("No uploader account");
const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
const s3 = new S3Client({ region: "auto", endpoint: secrets.R2_ENDPOINT, forcePathStyle: true,
  credentials: { accessKeyId: secrets.R2_ACCESS_KEY_ID, secretAccessKey: secrets.R2_SECRET_ACCESS_KEY } });
let key;
let listingId;
try {
  await sql.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [tokenHash, user.id, new Date(Date.now() + 300000).toISOString()]);
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64"));
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "test.png");
  const response = await fetch("http://127.0.0.1:8787/api/media", {
    method: "POST", headers: { Cookie: `excell_session=${token}`, Origin: "http://127.0.0.1:8787" }, body: form,
  });
  if (response.status !== 201) throw new Error(`Upload HTTP ${response.status}`);
  const payload = await response.json();
  key = payload.url?.replace(/^\/api\/media\//, "");
  if (!key?.startsWith(`listings/${user.id}/`)) throw new Error("Unexpected image key");
  const image = await fetch(`http://127.0.0.1:8787${payload.url}`, { headers: { Cookie: `excell_session=${token}` } });
  if (image.status !== 200 || (await image.arrayBuffer()).byteLength !== png.length) throw new Error("Uploaded image readback failed");
  const locations = await (await fetch("http://127.0.0.1:8787/api/locations?city=%C4%B0stanbul&district=Kad%C4%B1k%C3%B6y")).json();
  const neighborhoodId = locations.neighborhoods?.[0]?.id;
  if (!neighborhoodId) throw new Error("Location lookup failed");
  const created = await fetch("http://127.0.0.1:8787/api/listings", {
    method: "POST", headers: { Cookie: `excell_session=${token}`, Origin: "http://127.0.0.1:8787", "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Entegrasyon testi için deneme dairesi", description: "Bu ilan Neon ve R2 entegrasyonunu doğrulayan geçici bir test kaydıdır.",
      purpose: "satilik", propertyType: "daire", price: 123456, currency: "TRY", city: "İstanbul", district: "Kadıköy", neighborhoodId, grossArea: 80, images: [payload.url] }),
  });
  if (created.status !== 201) throw new Error(`Listing HTTP ${created.status}`);
  listingId = (await created.json()).id;
  const records = await sql.query("SELECT l.status,count(p.id)::int AS photos FROM listings l LEFT JOIN property_images p ON p.property_id=l.id WHERE l.id=$1 GROUP BY l.id", [listingId]);
  if (records[0]?.status !== "pending" || records[0]?.photos !== 1) throw new Error("Listing/photo record mismatch");
  const publicDetail = await fetch(`http://127.0.0.1:8787/api/listings/${listingId}`);
  if (publicDetail.status !== 404) throw new Error("Pending listing exposed publicly");
  process.stdout.write("Authenticated R2 upload, Neon listing, photo link and moderation gate verified.\n");
} catch (error) {
  process.stderr.write(`R2 upload smoke test failed (${error.message?.replace(/https?:\/\/[^\s]+/g, "[URL]") || error.name}).\n`);
  process.exitCode = 1;
} finally {
  if (listingId) await sql.query("DELETE FROM listings WHERE id=$1", [listingId]);
  if (key) await s3.send(new DeleteObjectCommand({ Bucket: secrets.R2_BUCKET_NAME, Key: key }));
  await sql.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
}
