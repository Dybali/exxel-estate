import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const secrets = Object.fromEntries((await readFile("work/integration-secrets.env", "utf8"))
  .split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")]));
if (!secrets.DATABASE_URL) throw new Error("DATABASE_URL missing");
const sql = neon(secrets.DATABASE_URL);
try {
await sql.query("SELECT 1", []);
await sql.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())", []);
const files = (await readdir("postgres/migrations")).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
for (const file of files) {
  const applied = await sql.query("SELECT version FROM schema_migrations WHERE version=$1", [file]);
  if (applied.length) continue;
  const source = await readFile(join("postgres/migrations", file), "utf8");
  for (const statement of source.split(";").map((part) => part.trim()).filter(Boolean)) await sql.query(statement, []);
  await sql.query("INSERT INTO schema_migrations(version) VALUES($1)", [file]);
  process.stdout.write(`Applied ${file}\n`);
}
const check = await sql.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'", []);
process.stdout.write(`Neon ready; ${check[0].n} tables.\n`);
} catch (error) {
  process.stderr.write(`Neon migration failed (${error.code || error.name || "unknown"}).\n`);
  process.exitCode = 1;
}
