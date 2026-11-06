// Database side of the fraud and duplicate check (lib/listing-risk.ts). Plain SQL that runs on
// SQLite/D1 and, through lib/pg-d1.ts, on PostgreSQL; no new tables or columns. Detection data
// lives in listings.presentation: photoHashes {url: dHash}, risk (latest check), riskFlag
// ("medium" | "high" while an administrator has not looked at it).
import {
  BACKFILL_PHOTOS, RISK_CANDIDATE_LIMIT, applyRisk, clearRisk, evaluateRisk, photoHashList, phonesIn, riskOf, validPhotoHash,
  type RiskAssessment, type RiskCandidate, type RiskSubject, type StoredRisk,
} from "./listing-risk";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<unknown> }
export type RiskDatabase = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };
type Row = Record<string, unknown>;

// Demo and sample listings live in code, never in the database; should one be stored, it is ignored.
const NOT_DEMO = "CAST(l.id AS TEXT) NOT LIKE 'ex-%' AND CAST(l.id AS TEXT) NOT LIKE 'sample-%'";
const CANDIDATE_COLUMNS = "CAST(l.id AS TEXT) AS id,CAST(l.owner_id AS TEXT) AS owner_id,l.title,l.description,l.purpose,l.property_type,l.city,l.district,l.price,l.currency,l.gross_area,l.status,l.expires_at,json_extract(l.presentation,'$.photoHashes') AS photo_hashes";

const candidateFrom = (row: Row): RiskCandidate => ({
  id: String(row.id), ownerId: String(row.owner_id), title: String(row.title || ""), description: String(row.description || ""),
  purpose: String(row.purpose || ""), propertyType: String(row.property_type || ""), city: String(row.city || ""), district: String(row.district || ""),
  price: Number(row.price) || 0, currency: String(row.currency || ""), grossArea: Number(row.gross_area) || 0, status: String(row.status || ""),
  expiresAt: row.expires_at ? String(row.expires_at) : null, photoHashes: photoHashList(row.photo_hashes),
});

export type RiskInput = RiskSubject & { checksums: string[] };

/** Runs the queries for one listing and scores it. Bounded: at most RISK_CANDIDATE_LIMIT candidates. */
export async function assessListingRisk(db: RiskDatabase, subject: RiskInput, now = new Date()): Promise<RiskAssessment> {
  const checksums = [...new Set(subject.checksums.filter((value) => /^[a-f0-9]{64}$/.test(value)))].slice(0, 30);
  const since = new Date(now.getTime() - 86400000).toISOString();
  const [candidates, exactRows, comparables, owner, recent] = await Promise.all([
    db.prepare(`SELECT ${CANDIDATE_COLUMNS} FROM listings l WHERE CAST(l.id AS TEXT)<>? AND (l.city=? OR CAST(l.owner_id AS TEXT)=?) AND ${NOT_DEMO} ORDER BY l.created_at DESC LIMIT ${RISK_CANDIDATE_LIMIT}`)
      .bind(subject.id, subject.city, subject.ownerId).all<Row>().then((r) => r.results || []),
    checksums.length ? db.prepare(`SELECT CAST(pi.property_id AS TEXT) AS id,COUNT(DISTINCT pi.checksum_sha256) AS n FROM property_images pi WHERE pi.checksum_sha256 IN (${checksums.map(() => "?").join(",")}) AND CAST(pi.property_id AS TEXT)<>? GROUP BY pi.property_id LIMIT 20`)
      .bind(...checksums, subject.id).all<Row>().then((r) => r.results || []) : Promise.resolve([] as Row[]),
    db.prepare(`SELECT l.price,l.gross_area FROM listings l WHERE l.city=? AND l.district=? AND l.purpose=? AND l.property_type=? AND l.currency='TRY' AND l.status='published' AND CAST(l.id AS TEXT)<>? AND l.gross_area>0 AND ${NOT_DEMO} ORDER BY l.created_at DESC LIMIT 200`)
      .bind(subject.city, subject.district, subject.purpose, subject.propertyType, subject.id).all<Row>().then((r) => r.results || []),
    db.prepare("SELECT created_at,phone,company FROM users WHERE CAST(id AS TEXT)=?").bind(subject.ownerId).first<Row>(),
    db.prepare("SELECT COUNT(*) AS n FROM listings l WHERE CAST(l.owner_id AS TEXT)=? AND l.created_at>? AND CAST(l.id AS TEXT)<>?").bind(subject.ownerId, since, subject.id).first<Row>(),
  ]);
  const list = candidates.map(candidateFrom), byId = new Map(list.map((item) => [item.id, item]));
  // Identical stored files (property_images.checksum_sha256) can sit in another city: load those listings too.
  const exact = new Map(exactRows.filter((row) => !/^(ex-|sample-)/.test(String(row.id))).map((row) => [String(row.id), Number(row.n) || 0]));
  const missing = [...exact.keys()].filter((id) => !byId.has(id));
  if (missing.length) {
    const rows = await db.prepare(`SELECT ${CANDIDATE_COLUMNS} FROM listings l WHERE CAST(l.id AS TEXT) IN (${missing.map(() => "?").join(",")}) AND ${NOT_DEMO}`).bind(...missing).all<Row>();
    for (const row of rows.results || []) { const item = candidateFrom(row); list.push(item); byId.set(item.id, item); }
  }
  for (const [id, n] of exact) { const item = byId.get(id); if (item) item.exact = n; }
  // Other accounts with the owner's phone or a phone from the description (same company excluded: one office, several agents).
  const phones = [...new Set([owner?.phone ? String(owner.phone) : "", ...phonesIn(subject.description)].filter(Boolean))].slice(0, 10);
  const company = String(owner?.company || "").trim();
  const phoneAccounts = phones.length ? Number((await db.prepare(`SELECT COUNT(DISTINCT CAST(u.id AS TEXT)) AS n FROM users u WHERE u.phone IN (${phones.map(() => "?").join(",")}) AND CAST(u.id AS TEXT)<>? AND (?='' OR COALESCE(u.company,'')<>?)`)
    .bind(...phones, subject.ownerId, company, company).first<Row>())?.n) || 0 : 0;
  return evaluateRisk(subject, {
    candidates: list,
    comparables: comparables.map((row) => Number(row.price) / Number(row.gross_area)),
    owner: { createdAt: owner?.created_at ? String(owner.created_at) : null, recentListings: (Number(recent?.n) || 0) + 1 },
    phoneAccounts, now,
  });
}

/**
 * Listing save (POST/PATCH /api/listings): stores the photo fingerprints and the check in `target`.
 * A failing check never blocks the save; the previous result is kept and the error logged.
 */
export async function assessListingSave(db: RiskDatabase, input: RiskInput & { images: string[]; hashes: Record<string, string> }, target: Record<string, unknown>, previous: unknown, actorIsAdmin: boolean, now = new Date()) {
  const photoHashes = Object.fromEntries(input.images.filter((url) => validPhotoHash(input.hashes[url])).map((url) => [url, input.hashes[url]]));
  target.photoHashes = photoHashes;
  try {
    const assessment = await assessListingRisk(db, { ...input, photoHashes: Object.values(photoHashes) }, now);
    return applyRisk(target, previous, assessment, actorIsAdmin);
  } catch (cause) {
    console.error("listing risk check failed", cause);
    const old = previous && typeof previous === "object" ? previous as Record<string, unknown> : {};
    if (old.risk) target.risk = old.risk;
    if (old.riskFlag) target.riskFlag = old.riskFlag;
    return { flag: null, route: false };
  }
}

/** Previous photo fingerprints for photos the listing keeps (PATCH). */
export function keptPhotoHashes(previous: unknown, images: string[]) {
  const stored = previous && typeof previous === "object" ? (previous as Record<string, unknown>).photoHashes : null;
  if (!stored || typeof stored !== "object") return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter(([url, hash]) => images.includes(url) && validPhotoHash(hash))) as Record<string, string>;
}

// ---------------------------------------------------------------- admin

export type SuspiciousListing = {
  id: string; title: string; city: string; district: string; price: number; currency: string; grossArea: number; purpose: string; propertyType: string;
  status: string; images: string[]; createdAt: string; owner: { id: string; name: string; email: string; createdAt: string }; risk: StoredRisk; flag: string;
  matches: (StoredRisk["matches"][number] & { listing: { id: string; title: string; city: string; district: string; price: number; currency: string; grossArea: number; status: string; images: string[]; ownerName: string } | null })[];
};

const images = (value: unknown) => { try { const list = JSON.parse(String(value || "[]")); return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };

/** Open flags for the "Şüpheli ilanlar" view, high first, with the matched listings side by side. */
export async function suspiciousListings(db: RiskDatabase, limit = 100): Promise<SuspiciousListing[]> {
  const rows = (await db.prepare(`SELECT CAST(l.id AS TEXT) AS id,CAST(l.owner_id AS TEXT) AS owner_id,l.title,l.city,l.district,l.price,l.currency,l.gross_area,l.purpose,l.property_type,l.status,l.images,l.created_at,l.presentation,u.name AS owner_name,u.email AS owner_email,u.created_at AS owner_created_at FROM listings l JOIN users u ON u.id=l.owner_id WHERE json_extract(l.presentation,'$.riskFlag') IS NOT NULL AND ${NOT_DEMO} ORDER BY l.created_at DESC LIMIT ?`).bind(limit).all<Row>()).results || [];
  const items = rows.map((row) => {
    let presentation: Record<string, unknown> = {};
    try { presentation = JSON.parse(String(row.presentation || "{}")); } catch { /* unreadable row: skipped below */ }
    return { row, risk: riskOf(presentation), flag: String(presentation.riskFlag || "") };
  }).filter((item): item is { row: Row; risk: StoredRisk; flag: string } => Boolean(item.risk && item.flag));
  const ids = [...new Set(items.flatMap((item) => item.risk.matches.map((match) => match.id)))].filter((id) => !/^(ex-|sample-)/.test(id)).slice(0, 400);
  const matched = new Map<string, Row>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const found = await db.prepare(`SELECT CAST(l.id AS TEXT) AS id,l.title,l.city,l.district,l.price,l.currency,l.gross_area,l.status,l.images,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE CAST(l.id AS TEXT) IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all<Row>();
    for (const row of found.results || []) matched.set(String(row.id), row);
  }
  return items.map(({ row, risk, flag }) => ({
    id: String(row.id), title: String(row.title || ""), city: String(row.city || ""), district: String(row.district || ""), price: Number(row.price) || 0, currency: String(row.currency || "TRY"),
    grossArea: Number(row.gross_area) || 0, purpose: String(row.purpose || ""), propertyType: String(row.property_type || ""), status: String(row.status || ""), images: images(row.images).slice(0, 4), createdAt: String(row.created_at || ""),
    owner: { id: String(row.owner_id), name: String(row.owner_name || ""), email: String(row.owner_email || ""), createdAt: String(row.owner_created_at || "") },
    risk: { ...risk, signature: [] }, flag,
    matches: risk.matches.map((match) => {
      const other = matched.get(match.id);
      return { ...match, listing: other ? { id: match.id, title: String(other.title || ""), city: String(other.city || ""), district: String(other.district || ""), price: Number(other.price) || 0, currency: String(other.currency || "TRY"), grossArea: Number(other.gross_area) || 0, status: String(other.status || ""), images: images(other.images).slice(0, 4), ownerName: String(other.owner_name || "") } : null };
    }),
  })).sort((a, b) => (a.flag === "high" ? 0 : 1) - (b.flag === "high" ? 0 : 1) || b.risk.score - a.risk.score || b.createdAt.localeCompare(a.createdAt));
}

export class RiskActionError extends Error { constructor(message: string, public status = 400) { super(message); } }

/**
 * "Sorun yok": closes the open flag and records it in admin_audit (created by lib/reports-server.ts).
 * `audit: false` is used when the decision is already audited (an administrator publishing the listing).
 */
export async function clearRiskFlag(db: RiskDatabase, listingId: string, admin: { id: string; name: string }, options: { audit?: boolean; at?: string } = {}) {
  const at = options.at || new Date().toISOString();
  const row = await db.prepare("SELECT presentation FROM listings WHERE CAST(id AS TEXT)=?").bind(listingId).first<{ presentation: string | null }>();
  if (!row) throw new RiskActionError("İlan bulunamadı.", 404);
  let presentation: Record<string, unknown>;
  try { presentation = JSON.parse(String(row.presentation || "{}")); } catch { throw new RiskActionError("İlan verisi okunamadı.", 409); }
  if (!presentation.riskFlag) { if (options.audit === false) return false; throw new RiskActionError("Bu ilan için açık bir uyarı yok.", 409); }
  const next = clearRisk(presentation, admin, at);
  if (!next) return false;
  const risk = riskOf(presentation)!;
  const statements = [db.prepare("UPDATE listings SET presentation=? WHERE CAST(id AS TEXT)=? AND presentation=?").bind(JSON.stringify(next), listingId, String(row.presentation))];
  if (options.audit !== false) statements.push(db.prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), admin.id, admin.name, "risk_clear", listingId, `Sorun yok · ${risk.score}/100 · ${risk.reasons.map((reason) => reason.code).join(", ")}`, at));
  await db.batch(statements);
  const saved = await db.prepare("SELECT presentation FROM listings WHERE CAST(id AS TEXT)=?").bind(listingId).first<{ presentation: string | null }>();
  if (String(saved?.presentation) !== JSON.stringify(next)) throw new RiskActionError("İlan bu sırada değişti. Sayfayı yenileyip tekrar deneyin.", 409);
  return true;
}

/** Old listings without photo fingerprints, oldest first, for the admin backfill (fingerprinted in the admin's browser). */
export async function backfillQueue(db: RiskDatabase, limit = 50) {
  const where = `json_extract(l.presentation,'$.photoHashes') IS NULL AND l.status IN ('published','pending') AND ${NOT_DEMO}`;
  const [rows, total] = await Promise.all([
    db.prepare(`SELECT CAST(l.id AS TEXT) AS id,l.images FROM listings l WHERE ${where} ORDER BY l.created_at ASC LIMIT ?`).bind(limit).all<Row>(),
    db.prepare(`SELECT COUNT(*) AS n FROM listings l WHERE ${where}`).first<Row>(),
  ]);
  return { items: (rows.results || []).map((row) => ({ id: String(row.id), images: images(row.images).filter((url) => url.startsWith("/api/media/")).slice(0, BACKFILL_PHOTOS) })), remaining: Number(total?.n) || 0 };
}

/**
 * Stores fingerprints sent by the admin backfill and re-checks the listing. The listing status is
 * never changed here: an old listing can only be flagged for administrators.
 */
export async function storeBackfill(db: RiskDatabase, listingId: string, hashes: Record<string, unknown>, now = new Date()) {
  const row = await db.prepare("SELECT CAST(l.id AS TEXT) AS id,CAST(l.owner_id AS TEXT) AS owner_id,l.title,l.description,l.purpose,l.property_type,l.city,l.district,l.price,l.currency,l.gross_area,l.images,l.presentation FROM listings l WHERE CAST(l.id AS TEXT)=?").bind(listingId).first<Row>();
  if (!row || /^(ex-|sample-)/.test(listingId)) throw new RiskActionError("İlan bulunamadı.", 404);
  const list = images(row.images);
  let presentation: Record<string, unknown>;
  try { presentation = JSON.parse(String(row.presentation || "{}")); } catch { throw new RiskActionError("İlan verisi okunamadı.", 409); }
  const known = keptPhotoHashes(presentation, list);
  for (const [url, hash] of Object.entries(hashes || {})) if (list.includes(url) && validPhotoHash(hash)) known[url] = hash;
  const checksums = ((await db.prepare("SELECT checksum_sha256 FROM property_images WHERE CAST(property_id AS TEXT)=?").bind(listingId).all<Row>()).results || []).map((r) => String(r.checksum_sha256 || ""));
  const next: Record<string, unknown> = { ...presentation };
  const result = await assessListingSave(db, {
    id: listingId, ownerId: String(row.owner_id), title: String(row.title || ""), description: String(row.description || ""), purpose: String(row.purpose || ""), propertyType: String(row.property_type || ""),
    city: String(row.city || ""), district: String(row.district || ""), price: Number(row.price) || 0, currency: String(row.currency || ""), grossArea: Number(row.gross_area) || 0,
    photoHashes: [], checksums, images: list, hashes: known,
  }, next, presentation, true, now);
  await db.prepare("UPDATE listings SET presentation=? WHERE CAST(id AS TEXT)=? AND presentation=?").bind(JSON.stringify(next), listingId, String(row.presentation)).run();
  return { flag: result.flag, photos: Object.keys(next.photoHashes as object).length };
}
