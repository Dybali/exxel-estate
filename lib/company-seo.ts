import { db } from "./server";

const APPROVED = "FROM agencies a JOIN users u ON u.id=a.owner_id WHERE a.status='approved' AND u.role='agent' AND u.agent_status='approved'";

export async function companyDirectoryEntries() {
  const rows = await db().prepare(`SELECT a.id ${APPROVED} ORDER BY a.id LIMIT 5000`).all<{ id: string }>();
  return rows.results.map((row) => ({ id: String(row.id) }));
}

export async function companySummary(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  return db().prepare(`SELECT a.id, a.name, a.category ${APPROVED} AND a.id=?`).bind(id).first<{ id: string; name: string; category: string | null }>();
}
