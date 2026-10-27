import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const line = (await readFile("work/integration-secrets.env", "utf8")).split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
const url = line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);
const email = `test-${randomBytes(8).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("hex");
let userId;
try {
  const request = (data) => fetch("http://127.0.0.1:8787/api/account", { method: "POST",
    headers: { Origin: "http://127.0.0.1:8787", "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const registered = await request({ action: "register", email, password, name: "Test Agent", role: "agent", company: "Integration Test Office" });
  if (registered.status !== 201) throw new Error(`Register HTTP ${registered.status}`);
  userId = (await registered.json()).user.id;
  const agent = await sql.query("SELECT u.agent_status,a.name,a.status FROM users u JOIN agencies a ON a.owner_id=u.id WHERE u.id=$1", [userId]);
  if (agent[0]?.agent_status !== "pending" || agent[0]?.status !== "pending") throw new Error("Agency record missing");
  const loggedIn = await request({ action: "login", email, password });
  if (loggedIn.status !== 200 || (await loggedIn.json()).user.id !== userId) throw new Error("Login failed");
  const cookie = loggedIn.headers.get("set-cookie")?.split(";")[0];
  const admin = await fetch("http://127.0.0.1:8787/api/admin", { headers: { Cookie: cookie } });
  if (admin.status !== 403) throw new Error("Agent gained admin access");
  process.stdout.write("Registration, agency record, login and role guard verified.\n");
} catch (error) {
  process.stderr.write(`Auth smoke test failed (${error.message?.replace(/https?:\/\/[^\s]+/g, "[URL]") || error.name}).\n`);
  process.exitCode = 1;
} finally {
  if (userId) {
    await sql.query("DELETE FROM agencies WHERE owner_id=$1", [userId]);
    await sql.query("DELETE FROM users WHERE id=$1", [userId]);
  }
}
