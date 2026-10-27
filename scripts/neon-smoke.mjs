import { readFile } from "node:fs/promises";
import { neonD1 } from "../lib/neon-d1.ts";

const line = (await readFile("work/integration-secrets.env", "utf8")).split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL missing");
const url = line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
const db = neonD1(url);
try {
  const users = await db.prepare("SELECT count(*) AS n FROM users").first();
  const listings = await db.prepare("SELECT count(*) AS n FROM listings WHERE status=?").bind("pending").first();
  await db.prepare("SELECT count(*) AS n FROM listings l WHERE EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)").bind("Havuz").first();
  const batch = await db.batch([
    db.prepare("SELECT count(*) AS n FROM admin_setup"),
    db.prepare("SELECT count(*) AS n FROM property_images"),
  ]);
  if (Number(users.n) < 9 || Number(listings.n) < 1 || Number(batch[0][0].n) !== 1 || Number(batch[1][0].n) < 1) throw new Error("Data counts unexpected");
  process.stdout.write("Neon adapter and migrated data verified.\n");
} catch (error) {
  process.stderr.write(`Neon smoke test failed (${error.code || error.name || "unknown"}).\n`);
  process.exitCode = 1;
}
