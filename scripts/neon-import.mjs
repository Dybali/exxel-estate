import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const secrets = Object.fromEntries((await readFile("work/integration-secrets.env", "utf8"))
  .split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line))
  .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")]));
const sql = neon(secrets.DATABASE_URL);
try {
const order = ["users", "sessions", "oauth_accounts", "oauth_flows", "auth_limits", "admin_setup", "listings", "favorites", "messages", "packages", "purchases", "country_settings"];
let raw = "";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.endsWith("\u0004")) { raw = raw.slice(0, -1); break; }
}
const input = JSON.parse(raw);
for (const table of order) {
  const rows = input[table];
  if (!Array.isArray(rows)) throw new Error(`Missing ${table} dataset`);
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.some((name) => !/^[a-z_]+$/.test(name))) throw new Error("Invalid column name");
    const query = `INSERT INTO ${table} (${columns.map((name) => `"${name}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT DO NOTHING`;
    await sql.query(query, Object.values(row));
  }
  const count = await sql.query(`SELECT count(*)::int AS n FROM ${table}`, []);
  if (count[0].n < rows.length) throw new Error(`Count mismatch in ${table}`);
  process.stdout.write(`${table}: ${count[0].n}\n`);
}
const agents = await sql.query("SELECT id,company,agent_status,created_at FROM users WHERE role='agent' AND company IS NOT NULL", []);
for (const agent of agents) {
  await sql.query("INSERT INTO agencies(id,owner_id,name,status,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,status=excluded.status",
    [crypto.randomUUID(), agent.id, agent.company, agent.agent_status, agent.created_at]);
}
process.stdout.write(`agencies: ${agents.length}\n`);
} catch (error) {
  process.stderr.write(`Neon import failed (${error.code || error.name || "unknown"}).\n`);
  process.exitCode = 1;
}
