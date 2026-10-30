// Housing / development projects ("Projeler") published by approved agents and construction
// companies, moderated by an administrator, and reservation requests ("yer ayırtma talebi",
// no payment) that visitors send for a unit type. Tables are created on first use.
import { validRooms } from "./listing-details";
import { normalizeContactPhone } from "./phone";
import { AMENITIES } from "./listings";
import { validDistrict } from "./turkey-locations";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type ProjectDatabase = { prepare(sql: string): Statement };

export const PROJECT_STATUSES = ["ongoing", "completed"] as const;
export const PROJECT_MODERATIONS = ["pending", "approved", "rejected"] as const;
export const RESERVATION_STATUSES = ["new", "contacted", "reserved", "cancelled"] as const;
export const PROJECT_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];
export type ProjectModeration = typeof PROJECT_MODERATIONS[number];
export type ReservationStatus = typeof RESERVATION_STATUSES[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = { ongoing: "Devam ediyor", completed: "Tamamlandı" };
export const PROJECT_MODERATION_LABELS: Record<ProjectModeration, string> = { pending: "Onay bekliyor", approved: "Yayında", rejected: "Reddedildi" };
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = { new: "Yeni", contacted: "Görüşüldü", reserved: "Ayırtıldı", cancelled: "İptal" };
export const MAX_PROJECT_IMAGES = 30;
export const MAX_UNIT_TYPES = 20;
export const RESERVATIONS_PER_DAY = 5;
export const PROJECT_PAGE_SIZE = 12;

export const PROJECT_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,neighborhood TEXT,status TEXT NOT NULL,delivery_date TEXT,unit_types TEXT NOT NULL,total_units INTEGER,amenities TEXT NOT NULL DEFAULT '[]',images TEXT NOT NULL DEFAULT '[]',website TEXT,moderation TEXT NOT NULL DEFAULT 'pending',review_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id,created_at)",
  "CREATE INDEX IF NOT EXISTS projects_public_idx ON projects(moderation,city,updated_at)",
  "CREATE TABLE IF NOT EXISTS project_reservations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,owner_id TEXT NOT NULL,user_id TEXT,name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,unit_type TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS project_reservations_owner_idx ON project_reservations(owner_id,created_at)",
  "CREATE INDEX IF NOT EXISTS project_reservations_limit_idx ON project_reservations(project_id,email,created_at)",
];

export class ProjectError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensure(db: ProjectDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of PROJECT_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export type UnitType = { rooms: string; minArea: number; maxArea: number; priceFrom: number; currency: string };
export type Project = {
  id: string; ownerId: string; ownerName: string; ownerVerified: boolean; name: string; description: string; city: string; district: string; neighborhood: string | null;
  status: ProjectStatus; deliveryDate: string | null; unitTypes: UnitType[]; totalUnits: number | null; amenities: string[]; images: string[]; website: string | null;
  moderation: ProjectModeration; reviewNote?: string; createdAt: string; updatedAt: string; reservations?: number; newReservations?: number;
};
export type Reservation = { id: string; projectId: string; projectName: string; name: string; phone: string; email: string; unitType: string; message: string; status: ReservationStatus; createdAt: string; updatedAt: string };
export type Actor = { id: string; admin: boolean };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const validProjectId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const parse = <T>(value: unknown, fallback: T): T => { try { return value == null ? fallback : JSON.parse(String(value)) as T; } catch { return fallback; } };
// Same rule as OWNER_VERIFIED_SQL in lib/server.ts (approved agent with an approved office document).
const OWNER_SQL = "COALESCE(NULLIF(u.company,''),u.name) AS owner_name,(CASE WHEN u.role='agent' AND u.agent_status='approved' AND EXISTS(SELECT 1 FROM office_verifications ov WHERE ov.user_id=CAST(u.id AS TEXT) AND ov.state='approved') THEN 1 ELSE 0 END) AS owner_verified";
const SELECT_PROJECT = `SELECT p.*,${OWNER_SQL} FROM projects p LEFT JOIN users u ON CAST(u.id AS TEXT)=p.owner_id`;

function toProject(row: Record<string, unknown>, privateView = false): Project {
  const project: Project = {
    id: String(row.id), ownerId: String(row.owner_id), ownerName: row.owner_name ? String(row.owner_name) : "estatemarket24", ownerVerified: Number(row.owner_verified) === 1 || row.owner_verified === true,
    name: String(row.name), description: String(row.description), city: String(row.city), district: String(row.district), neighborhood: row.neighborhood ? String(row.neighborhood) : null,
    status: (PROJECT_STATUSES as readonly string[]).includes(String(row.status)) ? row.status as ProjectStatus : "ongoing", deliveryDate: row.delivery_date ? String(row.delivery_date) : null,
    unitTypes: parse<UnitType[]>(row.unit_types, []), totalUnits: row.total_units == null ? null : Number(row.total_units), amenities: parse<string[]>(row.amenities, []), images: parse<string[]>(row.images, []),
    website: row.website ? String(row.website) : null, moderation: (PROJECT_MODERATIONS as readonly string[]).includes(String(row.moderation)) ? row.moderation as ProjectModeration : "pending",
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
  if (privateView) project.reviewNote = row.review_note ? String(row.review_note) : "";
  if (row.reservations != null) { project.reservations = Number(row.reservations); project.newReservations = Number(row.new_reservations || 0); }
  return project;
}

// Lowest starting price of the project, per currency.
export function priceFrom(project: Pick<Project, "unitTypes">) {
  const best = new Map<string, number>();
  for (const unit of project.unitTypes) if (!best.has(unit.currency) || unit.priceFrom < best.get(unit.currency)!) best.set(unit.currency, unit.priceFrom);
  return [...best].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency === "TRY" ? -1 : b.currency === "TRY" ? 1 : 0);
}

function wholeNumber(value: unknown, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d{1,15}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
}

function unitTypes(value: unknown): UnitType[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_UNIT_TYPES) throw new ProjectError("En az bir, en fazla 20 konut tipi ekleyin.");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ProjectError("Konut tiplerini kontrol edin.");
    const unit = item as Record<string, unknown>, rooms = text(unit.rooms);
    if (!rooms || rooms.length > 10 || !validRooms(rooms)) throw new ProjectError("Oda sayısını 3+1 biçiminde yazın.");
    if (seen.has(rooms)) throw new ProjectError("Her oda tipini yalnızca bir kez ekleyin.");
    seen.add(rooms);
    const minArea = wholeNumber(unit.minArea, 1, 100000), maxArea = wholeNumber(unit.maxArea ?? unit.minArea, 1, 100000), price = wholeNumber(unit.priceFrom, 1, 1e13);
    if (minArea === null || maxArea === null || Number.isNaN(minArea) || Number.isNaN(maxArea) || maxArea < minArea) throw new ProjectError("Konut tipi metrekarelerini kontrol edin.");
    if (price === null || Number.isNaN(price)) throw new ProjectError("Konut tipi başlangıç fiyatını tam sayı olarak girin.");
    const currency = text(unit.currency || "TRY").toUpperCase();
    if (!(PROJECT_CURRENCIES as readonly string[]).includes(currency)) throw new ProjectError("Geçersiz para birimi.");
    return { rooms, minArea, maxArea, priceFrom: price, currency };
  });
}

export function projectImageKeys(images: unknown) {
  return (Array.isArray(images) ? images : []).filter((url): url is string => typeof url === "string" && url.startsWith("/api/media/listings/")).map((url) => url.slice("/api/media/".length));
}

// Validates every editable field; throws ProjectError with a Turkish message on the first problem.
export function validateProject(input: Record<string, unknown>, ownerId: string) {
  const name = text(input.name), description = text(input.description), city = text(input.city), district = text(input.district), neighborhood = text(input.neighborhood);
  if (name.length < 5 || name.length > 120) throw new ProjectError("Proje adı 5 ile 120 karakter arasında olmalıdır.");
  if (description.length < 30 || description.length > 5000) throw new ProjectError("Proje açıklaması 30 ile 5000 karakter arasında olmalıdır.");
  if (!city || city.length > 70 || !district || district.length > 70 || !validDistrict(city, district)) throw new ProjectError("Geçerli bir il ve ilçe seçin.");
  if (neighborhood.length > 80) throw new ProjectError("Mahalle adı en fazla 80 karakter olabilir.");
  const status = text(input.status);
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) throw new ProjectError("Proje durumunu seçin.");
  const deliveryDate = text(input.deliveryDate);
  if (deliveryDate && !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(deliveryDate)) throw new ProjectError("Teslim tarihini YYYY-AA biçiminde girin.");
  const totalUnits = wholeNumber(input.totalUnits, 1, 100000);
  if (Number.isNaN(totalUnits)) throw new ProjectError("Toplam konut sayısını kontrol edin.");
  const units = unitTypes(input.unitTypes);
  const amenities = input.amenities == null ? [] : input.amenities;
  if (!Array.isArray(amenities) || amenities.length > AMENITIES.length || amenities.some((item) => typeof item !== "string" || !AMENITIES.includes(item)) || new Set(amenities).size !== amenities.length) throw new ProjectError("Özellikleri kontrol edin.");
  const images = input.images;
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_PROJECT_IMAGES) throw new ProjectError("En az bir, en fazla 30 fotoğraf ekleyin.");
  const pattern = new RegExp(`^/api/media/listings/${ownerId.replace(/[^a-zA-Z0-9-]/g, "")}/[a-f0-9-]+\\.(jpg|png|webp)$`);
  if (images.some((url) => typeof url !== "string" || !pattern.test(url))) throw new ProjectError("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.", 403);
  if (new Set(images).size !== images.length) throw new ProjectError("Aynı fotoğraf birden fazla eklenemez.");
  const websiteInput = text(input.website);
  let website: string | null = null;
  if (websiteInput) {
    let url: URL | null = null;
    try { url = new URL(websiteInput); } catch { url = null; }
    if (!url || url.protocol !== "https:" || websiteInput.length > 300 || url.username || url.password) throw new ProjectError("Web sitesi https:// ile başlayan geçerli bir adres olmalıdır.");
    website = url.toString();
  }
  return { name, description, city, district, neighborhood: neighborhood || null, status: status as ProjectStatus, deliveryDate: deliveryDate || null, totalUnits, unitTypes: units, amenities: amenities as string[], images: images as string[], website };
}

// A photo may belong to one listing or one project only, so deleting one never removes another's photo.
async function assertImagesFree(db: ProjectDatabase, images: string[], projectId: string) {
  for (const url of images) {
    const key = url.slice("/api/media/".length);
    if (await db.prepare("SELECT 1 AS used FROM property_images WHERE object_key=?").bind(key).first()) throw new ProjectError("Bir ilanda kullanılan fotoğraf projeye eklenemez.", 409);
    if (await db.prepare("SELECT 1 AS used FROM projects WHERE id<>? AND images LIKE ?").bind(projectId, `%"${url}"%`).first()) throw new ProjectError("Bu fotoğraf başka bir projede kullanılıyor.", 409);
  }
}

export async function createProject(db: ProjectDatabase, actor: Actor, input: Record<string, unknown>, at = new Date()) {
  const clean = validateProject(input, actor.id);
  await ensure(db);
  const id = crypto.randomUUID(), stamp = at.toISOString();
  await assertImagesFree(db, clean.images, id);
  // Administrators publish directly; everyone else waits for review.
  const moderation: ProjectModeration = actor.admin ? "approved" : "pending";
  await db.prepare("INSERT INTO projects(id,owner_id,name,description,city,district,neighborhood,status,delivery_date,unit_types,total_units,amenities,images,website,moderation,review_note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',?,?)")
    .bind(id, actor.id, clean.name, clean.description, clean.city, clean.district, clean.neighborhood, clean.status, clean.deliveryDate, JSON.stringify(clean.unitTypes), clean.totalUnits, JSON.stringify(clean.amenities), JSON.stringify(clean.images), clean.website, moderation, stamp, stamp).run();
  return { id, moderation };
}

async function projectRow(db: ProjectDatabase, id: string) {
  if (!validProjectId(id)) return null;
  await ensure(db);
  return db.prepare(`${SELECT_PROJECT} WHERE p.id=?`).bind(id).first<Record<string, unknown>>();
}

const inputFromRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  name: row.name, description: row.description, city: row.city, district: row.district, neighborhood: row.neighborhood || "", status: row.status, deliveryDate: row.delivery_date || "",
  totalUnits: row.total_units == null ? "" : Number(row.total_units), unitTypes: parse(row.unit_types, []), amenities: parse(row.amenities, []), images: parse(row.images, []), website: row.website || "",
});
const EDITABLE = ["name", "description", "city", "district", "neighborhood", "status", "deliveryDate", "totalUnits", "unitTypes", "amenities", "images", "website"];

// Owner or admin. Edits by the owner go back to review; returns photo keys no longer used.
export async function updateProject(db: ProjectDatabase, actor: Actor, id: string, input: Record<string, unknown>, at = new Date()) {
  const row = await projectRow(db, id);
  if (!row) throw new ProjectError("Proje bulunamadı.", 404);
  const ownerId = String(row.owner_id);
  if (ownerId !== actor.id && !actor.admin) throw new ProjectError("Bu projeyi düzenleme yetkiniz yok.", 403);
  const merged = inputFromRow(row);
  for (const key of EDITABLE) if (Object.hasOwn(input, key)) merged[key] = input[key];
  const clean = validateProject(merged, ownerId);
  await assertImagesFree(db, clean.images, id);
  const moderation = actor.admin ? String(row.moderation) : "pending";
  const stamp = at.toISOString();
  await db.prepare("UPDATE projects SET name=?,description=?,city=?,district=?,neighborhood=?,status=?,delivery_date=?,unit_types=?,total_units=?,amenities=?,images=?,website=?,moderation=?,review_note=?,updated_at=? WHERE id=?")
    .bind(clean.name, clean.description, clean.city, clean.district, clean.neighborhood, clean.status, clean.deliveryDate, JSON.stringify(clean.unitTypes), clean.totalUnits, JSON.stringify(clean.amenities), JSON.stringify(clean.images), clean.website, moderation, actor.admin ? String(row.review_note || "") : "", stamp, id).run();
  const kept = new Set(projectImageKeys(clean.images));
  const previous = projectImageKeys(parse(row.images, []));
  return { id, moderation, updatedAt: stamp, removedKeys: previous.filter((key) => !kept.has(key)), addedKeys: [...kept].filter((key) => !previous.includes(key)) };
}

// Owner or admin. Removes the project and its reservation requests; returns photo keys to delete.
export async function deleteProject(db: ProjectDatabase, actor: Actor, id: string) {
  const row = await projectRow(db, id);
  if (!row) throw new ProjectError("Proje bulunamadı.", 404);
  if (String(row.owner_id) !== actor.id && !actor.admin) throw new ProjectError("Bu projeyi silme yetkiniz yok.", 403);
  await db.prepare("DELETE FROM project_reservations WHERE project_id=?").bind(id).run();
  await db.prepare("DELETE FROM projects WHERE id=?").bind(id).run();
  return { id, imageKeys: projectImageKeys(parse(row.images, [])) };
}

export type ProjectFilters = { city?: string | null; status?: string | null; rooms?: string | null; maxPrice?: string | null; currency?: string | null; page?: string | number | null };

// Approved projects only. City and status filter in SQL; room type and price in memory (JSON columns).
export async function publicProjects(db: ProjectDatabase, filters: ProjectFilters = {}) {
  await ensure(db);
  const where = ["p.moderation='approved'"], values: string[] = [];
  const city = text(filters.city), status = text(filters.status), rooms = text(filters.rooms);
  if (city && city.length <= 70) { where.push("p.city=?"); values.push(city); }
  if ((PROJECT_STATUSES as readonly string[]).includes(status)) { where.push("p.status=?"); values.push(status); }
  const rows = await db.prepare(`${SELECT_PROJECT} WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC, p.id DESC LIMIT 1000`).bind(...values).all<Record<string, unknown>>();
  const maxPrice = /^\d{1,13}$/.test(text(filters.maxPrice)) ? Number(text(filters.maxPrice)) : null;
  const currency = (PROJECT_CURRENCIES as readonly string[]).includes(text(filters.currency).toUpperCase()) ? text(filters.currency).toUpperCase() : "TRY";
  const matches = rows.results.map((row) => toProject(row)).filter((project) => {
    if (rooms && !project.unitTypes.some((unit) => unit.rooms === rooms)) return false;
    if (maxPrice !== null && !project.unitTypes.some((unit) => unit.currency === currency && unit.priceFrom <= maxPrice && (!rooms || unit.rooms === rooms))) return false;
    return true;
  });
  const page = Math.min(1000, Math.max(1, Math.floor(Number(filters.page)) || 1));
  return { projects: matches.slice((page - 1) * PROJECT_PAGE_SIZE, page * PROJECT_PAGE_SIZE), total: matches.length, page, pageSize: PROJECT_PAGE_SIZE };
}

// Approved projects are public; the owner and administrators also see pending and rejected ones.
export async function projectById(db: ProjectDatabase, id: string, viewer: Actor | null = null) {
  const row = await projectRow(db, id);
  if (!row) return null;
  const privileged = Boolean(viewer && (viewer.admin || viewer.id === String(row.owner_id)));
  if (row.moderation !== "approved" && !privileged) return null;
  return toProject(row, privileged);
}

export async function ownerProjects(db: ProjectDatabase, ownerId: string) {
  await ensure(db);
  const rows = await db.prepare(`SELECT p.*,${OWNER_SQL},(SELECT COUNT(*) FROM project_reservations r WHERE r.project_id=p.id) AS reservations,(SELECT COUNT(*) FROM project_reservations r WHERE r.project_id=p.id AND r.status='new') AS new_reservations FROM projects p LEFT JOIN users u ON CAST(u.id AS TEXT)=p.owner_id WHERE p.owner_id=? ORDER BY p.created_at DESC LIMIT 200`).bind(ownerId).all<Record<string, unknown>>();
  return rows.results.map((row) => toProject(row, true));
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

// Works without an account. Only approved projects accept requests; at most 5 per e-mail and project a day.
export async function createReservation(db: ProjectDatabase, projectId: string, input: Record<string, unknown>, userId: string | null, at = new Date()) {
  const row = await projectRow(db, projectId);
  if (!row || row.moderation !== "approved") throw new ProjectError("Proje bulunamadı.", 404);
  const name = text(input.name), email = text(input.email).toLowerCase(), unitType = text(input.unitType), message = text(input.message), phone = normalizeContactPhone(input.phone);
  if (name.length < 2 || name.length > 100) throw new ProjectError("Adınızı ve soyadınızı yazın.");
  if (!phone) throw new ProjectError("Geçerli bir telefon numarası yazın.");
  if (email.length > 254 || !EMAIL.test(email)) throw new ProjectError("Geçerli bir e-posta adresi yazın.");
  const units = parse<UnitType[]>(row.unit_types, []);
  if (!units.some((unit) => unit.rooms === unitType)) throw new ProjectError("Projede bulunan bir konut tipi seçin.");
  if (message.length > 1000) throw new ProjectError("Mesajınız en fazla 1000 karakter olabilir.");
  if (input.consent !== true) throw new ProjectError("Devam etmek için kişisel verilerin işlenmesini onaylayın.");
  const since = new Date(at.getTime() - 86400000).toISOString();
  const count = await db.prepare("SELECT COUNT(*) AS n FROM project_reservations WHERE project_id=? AND email=? AND created_at>?").bind(projectId, email, since).first<{ n: number }>();
  if (Number(count?.n || 0) >= RESERVATIONS_PER_DAY) throw new ProjectError("Bu proje için bugün çok fazla talep gönderdiniz. Lütfen daha sonra tekrar deneyin.", 429);
  const id = crypto.randomUUID(), stamp = at.toISOString(), ownerId = String(row.owner_id);
  await db.prepare("INSERT INTO project_reservations(id,project_id,owner_id,user_id,name,phone,email,unit_type,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'new',?,?)")
    .bind(id, projectId, ownerId, userId, name, phone, email, unitType, message, stamp, stamp).run();
  return { id, projectId, projectName: String(row.name), ownerId, unitType, name, status: "new" as ReservationStatus };
}

export async function ownerReservations(db: ProjectDatabase, ownerId: string): Promise<Reservation[]> {
  await ensure(db);
  const rows = await db.prepare("SELECT r.id,r.project_id,p.name AS project_name,r.name,r.phone,r.email,r.unit_type,r.message,r.status,r.created_at,r.updated_at FROM project_reservations r JOIN projects p ON p.id=r.project_id WHERE r.owner_id=? AND p.owner_id=? ORDER BY r.created_at DESC LIMIT 500").bind(ownerId, ownerId).all<Record<string, unknown>>();
  return rows.results.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), projectName: String(row.project_name), name: String(row.name), phone: String(row.phone), email: String(row.email), unitType: String(row.unit_type),
    message: String(row.message || ""), status: (RESERVATION_STATUSES as readonly string[]).includes(String(row.status)) ? row.status as ReservationStatus : "new", createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
}

export async function updateReservationStatus(db: ProjectDatabase, ownerId: string, id: unknown, status: unknown, at = new Date()) {
  if (typeof id !== "string" || !UUID.test(id) || typeof status !== "string" || !(RESERVATION_STATUSES as readonly string[]).includes(status)) throw new ProjectError("Talep durumunu kontrol edin.");
  await ensure(db);
  const row = await db.prepare("UPDATE project_reservations SET status=?,updated_at=? WHERE id=? AND owner_id=? RETURNING id").bind(status, at.toISOString(), id, ownerId).first();
  if (!row) throw new ProjectError("Talep bulunamadı.", 404);
  return { id, status: status as ReservationStatus };
}

export async function adminPendingProjects(db: ProjectDatabase) {
  await ensure(db);
  const rows = await db.prepare(`${SELECT_PROJECT} WHERE p.moderation='pending' ORDER BY p.updated_at ASC LIMIT 200`).all<Record<string, unknown>>();
  return rows.results.map((row) => toProject(row, true));
}

export async function reviewProject(db: ProjectDatabase, adminId: string, id: unknown, decision: unknown, note: unknown, at = new Date()) {
  if (!validProjectId(id) || (decision !== "approved" && decision !== "rejected")) throw new ProjectError("Geçersiz işlem.");
  const reason = text(note);
  if (reason.length > 1000) throw new ProjectError("İnceleme notu en fazla 1000 karakter olabilir.");
  if (decision === "rejected" && reason.length < 5) throw new ProjectError("Reddetme nedenini yazın.");
  await ensure(db);
  const row = await db.prepare("UPDATE projects SET moderation=?,review_note=?,updated_at=? WHERE id=? RETURNING id,name,owner_id").bind(decision, reason, at.toISOString(), id).first<{ id: string; name: string; owner_id: string }>();
  if (!row) throw new ProjectError("Proje bulunamadı.", 404);
  return { id: String(row.id), name: String(row.name), ownerId: String(row.owner_id), moderation: decision as ProjectModeration, reviewedBy: adminId };
}

// Media route: a project photo is public once its project is approved.
export async function projectMediaPublic(db: ProjectDatabase, key: string) {
  if (!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return false;
  await ensure(db);
  return Boolean(await db.prepare("SELECT 1 AS ok FROM projects WHERE moderation='approved' AND images LIKE ?").bind(`%"/api/media/${key}"%`).first());
}
