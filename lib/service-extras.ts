// Service directory, phase 2 (/hizmetler): working information, firm documents ("Belgeli firma"),
// profile statistics and quote requests ("Teklif iste"). Tables are created on first use together with
// the firm tables (SERVICE_SCHEMA in lib/services.ts) and work on
// PostgreSQL and SQLite. Every function takes the database first so tests can pass node:sqlite.
//
//   service_firm_details     one row per firm: weekly hours, 7/24 emergency, price range. Saved without review.
//   service_firm_documents   tax certificate, licence, insurance… in private storage; admins review them.
//                            One approved document gives the "Belgeli firma" badge.
//   service_firm_stats       daily counters per firm and kind (view, phone, whatsapp, email, website, quote, offer).
//                            Counts only: no visitor, IP or session is stored.
//   service_quote_requests   a member describes a job once; it goes to up to QUOTE_LIMITS.recipients matching
//   service_quote_recipients firms (or to one firm from its profile), who answer with a price offer.
//   service_quote_offers     one offer per firm and request; the member compares and accepts one.
import { countFirmStat, firmDailyStats, type FirmStats } from "./firm-stats";
import { isServiceSlug, serviceCategory, type ServiceSlug } from "./service-categories";
import { normalizeContactPhone } from "./phone";
import { CITIES, validDistrict } from "./turkey-locations";
import { firmBadges, ServiceError, validFirmId, type ServiceDatabase } from "./services";

export { firmBadges };

type Row = Record<string, unknown>;


const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const parse = <T>(value: unknown, fallback: T): T => { try { return value == null || value === "" ? fallback : JSON.parse(String(value)) as T; } catch { return fallback; } };

// --- Working information ------------------------------------------------------------------------
/** Monday first. */
export const SERVICE_WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export const SERVICE_PRICE_UNITS = { job: "iş başı", hour: "saat başı", day: "gün başı", m2: "m² başı", visit: "ziyaret başı" } as const;
export type ServicePriceUnit = keyof typeof SERVICE_PRICE_UNITS;
/** [open, close] as "HH:MM", or null when closed that day. close "24:00" = until midnight. */
export type ServiceDayHours = [string, string] | null;
export type ServiceDetails = { hours: ServiceDayHours[]; emergency: boolean; priceMin: number | null; priceMax: number | null; priceUnit: ServicePriceUnit; priceNote: string };
export const EMPTY_SERVICE_DETAILS: ServiceDetails = { hours: [], emergency: false, priceMin: null, priceMax: null, priceUnit: "job", priceNote: "" };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const MAX_PRICE = 100_000_000;

/** Validates the "Çalışma bilgileri" form; hours [] means "not given". */
export function validateDetails(input: Record<string, unknown>): ServiceDetails {
  const rawHours = input.hours ?? [];
  if (!Array.isArray(rawHours) || (rawHours.length !== 0 && rawHours.length !== 7)) throw new ServiceError("Çalışma saatlerini kontrol edin.");
  const hours: ServiceDayHours[] = rawHours.map((day) => {
    if (day === null) return null;
    if (!Array.isArray(day) || day.length !== 2 || !day.every((time) => typeof time === "string" && TIME.test(time)) || day[0] === "24:00" || minutes(day[1]) <= minutes(day[0])) throw new ServiceError("Çalışma saatlerini kontrol edin: kapanış açılıştan sonra olmalıdır.");
    return [day[0], day[1]];
  });
  const price = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > MAX_PRICE) throw new ServiceError("Fiyatı TL olarak tam sayı yazın.");
    return number;
  };
  const priceMin = price(input.priceMin), priceMax = price(input.priceMax);
  if (priceMax !== null && priceMin === null) throw new ServiceError("En düşük fiyatı da yazın.");
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) throw new ServiceError("En yüksek fiyat en düşük fiyattan küçük olamaz.");
  const priceUnit = Object.hasOwn(SERVICE_PRICE_UNITS, String(input.priceUnit)) ? input.priceUnit as ServicePriceUnit : "job";
  const priceNote = clean(input.priceNote).replace(/\s+/g, " ");
  if (priceNote.length > 200) throw new ServiceError("Fiyat notu en fazla 200 karakter olabilir.");
  return { hours, emergency: input.emergency === true, priceMin, priceMax, priceUnit, priceNote };
}

const detailsFromRow = (row: Row | null | undefined): ServiceDetails => row ? {
  hours: parse<ServiceDayHours[]>(row.hours, []), emergency: Number(row.emergency) === 1,
  priceMin: row.price_min == null ? null : Number(row.price_min), priceMax: row.price_max == null ? null : Number(row.price_max),
  priceUnit: Object.hasOwn(SERVICE_PRICE_UNITS, String(row.price_unit)) ? row.price_unit as ServicePriceUnit : "job", priceNote: String(row.price_note || ""),
} : { ...EMPTY_SERVICE_DETAILS };

export async function firmDetails(db: ServiceDatabase, firmId: string) {
  return detailsFromRow(await db.prepare("SELECT * FROM service_firm_details WHERE firm_id=?").bind(firmId).first<Row>());
}
export async function saveDetails(db: ServiceDatabase, firmId: string, input: Record<string, unknown>, at = new Date()) {
  const details = validateDetails(input);
  await db.prepare("INSERT INTO service_firm_details(firm_id,hours,emergency,price_min,price_max,price_unit,price_note,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(firm_id) DO UPDATE SET hours=excluded.hours,emergency=excluded.emergency,price_min=excluded.price_min,price_max=excluded.price_max,price_unit=excluded.price_unit,price_note=excluded.price_note,updated_at=excluded.updated_at")
    .bind(firmId, JSON.stringify(details.hours), details.emergency ? 1 : 0, details.priceMin, details.priceMax, details.priceUnit, details.priceNote, at.toISOString()).run();
  return details;
}

/** Turkey has used UTC+3 all year since 2016. Monday = 0. */
export function istanbulClock(at = new Date()) {
  const local = new Date(at.getTime() + 3 * 3600_000);
  return { day: (local.getUTCDay() + 6) % 7, minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}
/** true/false when hours are given, null otherwise. A 7/24 emergency firm is always reachable. */
export function openNow(details: Pick<ServiceDetails, "hours" | "emergency">, at = new Date()): boolean | null {
  if (details.emergency) return true;
  if (details.hours.length !== 7) return null;
  const { day, minute } = istanbulClock(at), today = details.hours[day];
  return Boolean(today && minute >= minutes(today[0]) && minute < minutes(today[1]));
}

// --- Documents ----------------------------------------------------------------------------------
export const SERVICE_DOCUMENT_KINDS = { tax: "Vergi levhası", trade: "Ticaret sicil / oda kaydı", license: "Ustalık belgesi / meslek yeterlilik", permit: "Faaliyet izni / ruhsat", insurance: "Sigorta poliçesi", other: "Diğer belge" } as const;
export type ServiceDocumentKind = keyof typeof SERVICE_DOCUMENT_KINDS;
export const SERVICE_DOCUMENT_STATES = { pending: "İnceleme bekliyor", approved: "Onaylandı", rejected: "Düzeltme gerekli" } as const;
export type ServiceDocumentState = keyof typeof SERVICE_DOCUMENT_STATES;
export const SERVICE_DOCUMENT_LIMIT = 8;
export type ServiceDocument = { id: string; kind: ServiceDocumentKind; contentType: string; size: number; state: ServiceDocumentState; note: string; createdAt: string; reviewedAt: string | null };
export const isDocumentKind = (value: unknown): value is ServiceDocumentKind => typeof value === "string" && Object.hasOwn(SERVICE_DOCUMENT_KINDS, value);
const toDocument = (row: Row): ServiceDocument => ({
  id: String(row.id), kind: isDocumentKind(row.kind) ? row.kind : "other", contentType: String(row.content_type), size: Number(row.byte_size) || 0,
  state: Object.hasOwn(SERVICE_DOCUMENT_STATES, String(row.state)) ? row.state as ServiceDocumentState : "pending", note: String(row.note || ""),
  createdAt: String(row.created_at), reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
});

export async function firmDocuments(db: ServiceDatabase, firmId: string) {
  return ((await db.prepare("SELECT * FROM service_firm_documents WHERE firm_id=? ORDER BY created_at DESC,id ASC").bind(firmId).all<Row>()).results || []).map(toDocument);
}
/** Documents of several firms at once (admin list). */
export async function documentsOf(db: ServiceDatabase, firmIds: string[]) {
  const map = new Map<string, ServiceDocument[]>(firmIds.map((id) => [id, []]));
  if (!firmIds.length) return map;
  const rows = (await db.prepare(`SELECT * FROM service_firm_documents WHERE firm_id IN (${firmIds.map(() => "?").join(",")}) ORDER BY created_at DESC,id ASC`).bind(...firmIds).all<Row>()).results || [];
  for (const row of rows) map.get(String(row.firm_id))?.push(toDocument(row));
  return map;
}
/** Records an uploaded file (already stored under objectKey). */
export async function addDocument(db: ServiceDatabase, firmId: string, file: { id: string; kind: unknown; objectKey: string; contentType: string; size: number }, at = new Date()) {
  if (!isDocumentKind(file.kind)) throw new ServiceError("Belge türünü seçin.");
  const count = await db.prepare("SELECT COUNT(*) AS n FROM service_firm_documents WHERE firm_id=?").bind(firmId).first<Row>();
  if (Number(count?.n) >= SERVICE_DOCUMENT_LIMIT) throw new ServiceError("En fazla 8 belge yükleyebilirsiniz. Önce eski bir belgeyi silin.", 409);
  await db.prepare("INSERT INTO service_firm_documents(id,firm_id,kind,object_key,content_type,byte_size,state,note,created_at) VALUES(?,?,?,?,?,?,'pending','',?)")
    .bind(file.id, firmId, file.kind, file.objectKey, file.contentType, file.size, at.toISOString()).run();
  return toDocument({ id: file.id, kind: file.kind, content_type: file.contentType, byte_size: file.size, state: "pending", note: "", created_at: at.toISOString() });
}
/** Row with the storage key, for downloads and deletion; null when missing. */
export async function documentRow(db: ServiceDatabase, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const row = await db.prepare("SELECT d.*,f.owner_id AS owner_id,f.name AS firm_name FROM service_firm_documents d JOIN service_firms f ON f.id=d.firm_id WHERE d.id=?").bind(id).first<Row>();
  return row ? { ...toDocument(row), firmId: String(row.firm_id), ownerId: String(row.owner_id), firmName: String(row.firm_name), objectKey: String(row.object_key) } : null;
}
export async function deleteDocument(db: ServiceDatabase, firmId: string, id: unknown) {
  const row = await documentRow(db, id);
  if (!row || row.firmId !== firmId) throw new ServiceError("Belge bulunamadı.", 404);
  await db.prepare("DELETE FROM service_firm_documents WHERE id=?").bind(row.id).run();
  return row.objectKey;
}
/** Admin decision; a rejection needs a note the firm reads. */
export async function reviewDocument(db: ServiceDatabase, adminId: string, id: unknown, approve: boolean, note: unknown, at = new Date()) {
  const row = await documentRow(db, id);
  if (!row) throw new ServiceError("Belge bulunamadı.", 404);
  const reason = clean(note).slice(0, 1000);
  if (!approve && reason.length < 5) throw new ServiceError("Belgeyi reddetme nedenini yazın.");
  await db.prepare("UPDATE service_firm_documents SET state=?,note=?,reviewer_id=?,reviewed_at=? WHERE id=?").bind(approve ? "approved" : "rejected", approve ? "" : reason, adminId, at.toISOString(), row.id).run();
  return { ...row, state: approve ? "approved" as const : "rejected" as const, note: approve ? "" : reason };
}

// --- Statistics ---------------------------------------------------------------------------------
export const SERVICE_STAT_KINDS = ["view", "search", "phone", "whatsapp", "email", "website", "quote", "offer"] as const;
export type ServiceStatKind = typeof SERVICE_STAT_KINDS[number];
/** Kinds a visitor's browser may report (quote and offer are counted by the server); "search" = shown in search results. */
export const SERVICE_TRACKED_KINDS = ["view", "search", "phone", "whatsapp", "email", "website"] as const;
export const isTrackedKind = (value: unknown): value is typeof SERVICE_TRACKED_KINDS[number] => (SERVICE_TRACKED_KINDS as readonly unknown[]).includes(value);

export async function countStat(db: ServiceDatabase, firmId: string, kind: ServiceStatKind, at = new Date(), amount = 1) {
  await countFirmStat(db as never, "service_firm_stats", firmId, kind, at, amount);
}
/** Visitor event for an approved firm; false when the firm is not public. */
export async function trackFirm(db: ServiceDatabase, firmId: unknown, kind: unknown, at = new Date()) {
  if (!validFirmId(firmId) || !isTrackedKind(kind)) return false;
  if (!await db.prepare("SELECT 1 AS ok FROM service_firms WHERE id=? AND status='approved'").bind(firmId).first()) return false;
  await countStat(db, firmId, kind, at);
  return true;
}
export type ServiceStats = FirmStats<ServiceStatKind>;
/** Last `days` days (Istanbul calendar) with the period before for comparison, and a daily series. */
export const firmStats = (db: ServiceDatabase, firmId: string, days = 30, at = new Date()): Promise<ServiceStats> => firmDailyStats(db as never, "service_firm_stats", SERVICE_STAT_KINDS, firmId, days, at);

// --- Quote requests -----------------------------------------------------------------------------
export const QUOTE_TIMINGS = { asap: "Hemen / bu hafta", month: "Bu ay içinde", later: "1–3 ay içinde", flexible: "Esnek, tarih belli değil" } as const;
export type QuoteTiming = keyof typeof QUOTE_TIMINGS;
export const QUOTE_LIMITS = { descriptionMin: 20, descriptionMax: 2000, messageMin: 10, messageMax: 1500, recipients: 12, perDay: 5, days: 30 } as const;
export const QUOTE_STATUS_LABELS = { open: "Teklif bekleniyor", closed: "Kapatıldı", expired: "Süresi doldu", accepted: "Teklif kabul edildi" } as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS_LABELS;
export const QUOTE_RECIPIENT_LABELS = { new: "Yeni", seen: "Görüldü", offered: "Teklif verildi", declined: "Geçildi" } as const;
export type QuoteRecipientState = keyof typeof QUOTE_RECIPIENT_LABELS;

export type QuoteRequestInput = { name: string; email: string; phone: string | null; shareContact: boolean; category: ServiceSlug; city: string; district: string; description: string; timing: QuoteTiming; firmId: string | null };
export function validateQuoteRequest(input: Record<string, unknown>): QuoteRequestInput {
  const name = clean(input.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new ServiceError("Adınızı yazın.");
  const email = clean(input.email).toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new ServiceError("Geçerli bir e-posta adresi yazın.");
  const phone = clean(input.phone) ? normalizeContactPhone(input.phone) : null;
  if (clean(input.phone) && !phone) throw new ServiceError("Geçerli bir telefon numarası yazın.");
  if (!isServiceSlug(input.category)) throw new ServiceError("Hizmet kategorisini seçin.");
  const city = clean(input.city), district = clean(input.district);
  if (!CITIES.includes(city) || (district && !validDistrict(city, district))) throw new ServiceError("İşin yapılacağı il ve ilçeyi seçin.");
  const description = clean(input.description);
  if (description.length < QUOTE_LIMITS.descriptionMin || description.length > QUOTE_LIMITS.descriptionMax) throw new ServiceError("İşi en az 20, en fazla 2000 karakterle anlatın.");
  const timing = Object.hasOwn(QUOTE_TIMINGS, String(input.timing)) ? input.timing as QuoteTiming : "flexible";
  const firmId = input.firmId == null || input.firmId === "" ? null : validFirmId(input.firmId) ? input.firmId : "";
  if (firmId === "") throw new ServiceError("Firma bulunamadı.", 404);
  if (input.consent !== true) throw new ServiceError("Talebinizin uygun firmalara iletilmesini onaylayın.");
  return { name, email, phone, shareContact: input.shareContact === true && Boolean(phone), category: input.category, city, district, description, timing, firmId };
}

/** Approved firms offering the category in the place (a district also reaches province-wide firms), featured and documented first. */
export async function matchingFirms(db: ServiceDatabase, category: ServiceSlug, city: string, district: string, excludeOwner: string, limit: number = QUOTE_LIMITS.recipients) {
  const area = district ? "(a.district='' OR a.district=?)" : "1=1";
  const values: (string | number)[] = [category, city, ...(district ? [district] : []), excludeOwner, limit];
  const rows = (await db.prepare(`SELECT f.id AS id,f.owner_id AS owner_id,f.name AS name FROM service_firms f WHERE f.status='approved'
    AND EXISTS(SELECT 1 FROM service_firm_categories c WHERE c.firm_id=f.id AND c.category=?)
    AND EXISTS(SELECT 1 FROM service_firm_areas a WHERE a.firm_id=f.id AND a.city=? AND ${area})
    AND f.owner_id<>?
    ORDER BY f.featured DESC,(CASE WHEN EXISTS(SELECT 1 FROM service_firm_documents d WHERE d.firm_id=f.id AND d.state='approved') THEN 1 ELSE 0 END) DESC,f.verified DESC,f.created_at ASC,f.id ASC LIMIT ?`).bind(...values).all<Row>()).results || [];
  return rows.map((row) => ({ id: String(row.id), ownerId: String(row.owner_id), name: String(row.name) }));
}

export type QuoteRecipient = { id: string; ownerId: string; name: string };
/** Saves the request and its recipients; returns them for the e-mails. */
export async function createQuoteRequest(db: ServiceDatabase, userId: string, input: Record<string, unknown>, at = new Date()) {
  const request = validateQuoteRequest(input);
  const since = new Date(at.getTime() - 86400_000).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM service_quote_requests WHERE user_id=? AND created_at>=?").bind(userId, since).first<Row>();
  if (Number(recent?.n) >= QUOTE_LIMITS.perDay) throw new ServiceError("Bir günde en fazla 5 teklif talebi gönderebilirsiniz. Lütfen yarın tekrar deneyin.", 429);
  let recipients: QuoteRecipient[];
  if (request.firmId) {
    const firm = await db.prepare("SELECT id,owner_id,name FROM service_firms WHERE id=? AND status='approved'").bind(request.firmId).first<Row>();
    if (!firm) throw new ServiceError("Firma bulunamadı.", 404);
    if (String(firm.owner_id) === userId) throw new ServiceError("Kendi firmanızdan teklif isteyemezsiniz.");
    recipients = [{ id: String(firm.id), ownerId: String(firm.owner_id), name: String(firm.name) }];
  } else {
    recipients = await matchingFirms(db, request.category, request.city, request.district, userId);
    if (!recipients.length) throw new ServiceError("Bu hizmet ve bölge için henüz kayıtlı firma yok. İlçe yerine tüm ili seçmeyi veya yakın bir kategoriyi deneyin.", 404);
  }
  const id = crypto.randomUUID(), stamp = at.toISOString(), expires = new Date(at.getTime() + QUOTE_LIMITS.days * 86400_000).toISOString();
  await db.prepare("INSERT INTO service_quote_requests(id,user_id,name,email,phone,share_contact,category,city,district,description,timing,firm_id,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'open',?,?)")
    .bind(id, userId, request.name, request.email, request.phone, request.shareContact ? 1 : 0, request.category, request.city, request.district, request.description, request.timing, request.firmId, stamp, expires).run();
  for (const firm of recipients) {
    await db.prepare("INSERT INTO service_quote_recipients(request_id,firm_id,state,created_at) VALUES(?,?,'new',?)").bind(id, firm.id, stamp).run();
    await countStat(db, firm.id, "quote", at);
  }
  return { id, request, recipients };
}

const quoteStatus = (row: Row, at: Date): QuoteStatus => {
  if (String(row.status) === "accepted") return "accepted";
  if (String(row.status) === "closed") return "closed";
  return String(row.expires_at) <= at.toISOString() ? "expired" : "open";
};
export type QuoteOffer = { id: string; firmId: string; firmName: string; firmLogo: string | null; firmPhone: string; firmWhatsapp: string | null; firmEmail: string | null; verified: boolean; documented: boolean; priceMin: number; priceMax: number | null; message: string; state: "sent" | "accepted" | "rejected"; createdAt: string };
export type QuoteRequestView = { id: string; category: ServiceSlug; city: string; district: string; description: string; timing: QuoteTiming; status: QuoteStatus; createdAt: string; expiresAt: string; firmId: string | null; recipients: number; seen: number; offers: QuoteOffer[] };

/** The member's requests, newest first, each with its offers (cheapest first). */
export async function myQuoteRequests(db: ServiceDatabase, userId: string, at = new Date()): Promise<QuoteRequestView[]> {
  const requests = (await db.prepare("SELECT * FROM service_quote_requests WHERE user_id=? ORDER BY created_at DESC,id ASC LIMIT 50").bind(userId).all<Row>()).results || [];
  if (!requests.length) return [];
  const ids = requests.map((row) => String(row.id)), marks = ids.map(() => "?").join(",");
  const [recipients, offers] = await Promise.all([
    db.prepare(`SELECT request_id,state FROM service_quote_recipients WHERE request_id IN (${marks})`).bind(...ids).all<Row>(),
    db.prepare(`SELECT o.*,f.name AS firm_name,f.logo AS firm_logo,f.phone AS firm_phone,f.whatsapp AS firm_whatsapp,f.email AS firm_email,f.verified AS firm_verified FROM service_quote_offers o JOIN service_firms f ON f.id=o.firm_id WHERE o.request_id IN (${marks}) ORDER BY o.price_min ASC,o.created_at ASC`).bind(...ids).all<Row>(),
  ]);
  const badges = await firmBadges(db, [...new Set((offers.results || []).map((row) => String(row.firm_id)))]);
  return requests.map((row) => {
    const id = String(row.id), mine = (recipients.results || []).filter((item) => String(item.request_id) === id);
    return {
      id, category: row.category as ServiceSlug, city: String(row.city), district: String(row.district || ""), description: String(row.description), timing: (Object.hasOwn(QUOTE_TIMINGS, String(row.timing)) ? row.timing : "flexible") as QuoteTiming,
      status: quoteStatus(row, at), createdAt: String(row.created_at), expiresAt: String(row.expires_at), firmId: row.firm_id ? String(row.firm_id) : null,
      recipients: mine.length, seen: mine.filter((item) => String(item.state) !== "new").length,
      offers: (offers.results || []).filter((item) => String(item.request_id) === id).map((item) => ({
        id: String(item.id), firmId: String(item.firm_id), firmName: String(item.firm_name), firmLogo: item.firm_logo ? String(item.firm_logo) : null, firmPhone: String(item.firm_phone || ""),
        firmWhatsapp: item.firm_whatsapp ? String(item.firm_whatsapp) : null, firmEmail: item.firm_email ? String(item.firm_email) : null, verified: Number(item.firm_verified) === 1,
        documented: Boolean(badges.get(String(item.firm_id))?.documented), priceMin: Number(item.price_min), priceMax: item.price_max == null ? null : Number(item.price_max),
        message: String(item.message), state: (["sent", "accepted", "rejected"].includes(String(item.state)) ? item.state : "sent") as QuoteOffer["state"], createdAt: String(item.created_at),
      })),
    };
  });
}

async function ownRequest(db: ServiceDatabase, userId: string, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new ServiceError("Talep bulunamadı.", 404);
  const row = await db.prepare("SELECT * FROM service_quote_requests WHERE id=? AND user_id=?").bind(id, userId).first<Row>();
  if (!row) throw new ServiceError("Talep bulunamadı.", 404);
  return row;
}
export async function closeQuoteRequest(db: ServiceDatabase, userId: string, id: unknown) {
  const row = await ownRequest(db, userId, id);
  if (String(row.status) === "open") await db.prepare("UPDATE service_quote_requests SET status='closed' WHERE id=?").bind(String(row.id)).run();
  return { id: String(row.id) };
}
/** Accepts one offer: the request is settled and the other offers are marked as not chosen. */
export async function acceptOffer(db: ServiceDatabase, userId: string, offerId: unknown, at = new Date()) {
  if (typeof offerId !== "string" || !UUID.test(offerId)) throw new ServiceError("Teklif bulunamadı.", 404);
  const offer = await db.prepare("SELECT o.id AS id,o.request_id AS request_id,o.firm_id AS firm_id,f.owner_id AS owner_id,f.name AS firm_name FROM service_quote_offers o JOIN service_firms f ON f.id=o.firm_id WHERE o.id=?").bind(offerId).first<Row>();
  if (!offer) throw new ServiceError("Teklif bulunamadı.", 404);
  const request = await ownRequest(db, userId, String(offer.request_id));
  if (quoteStatus(request, at) !== "open") throw new ServiceError("Bu talep artık açık değil.", 409);
  await db.prepare("UPDATE service_quote_offers SET state=(CASE WHEN id=? THEN 'accepted' ELSE 'rejected' END) WHERE request_id=?").bind(offerId, String(request.id)).run();
  await db.prepare("UPDATE service_quote_requests SET status='accepted' WHERE id=?").bind(String(request.id)).run();
  return { requestId: String(request.id), firmId: String(offer.firm_id), ownerId: String(offer.owner_id), firmName: String(offer.firm_name), customerName: String(request.name) };
}

export type FirmInboxItem = {
  requestId: string; category: ServiceSlug; city: string; district: string; description: string; timing: QuoteTiming; createdAt: string; expiresAt: string;
  status: QuoteStatus; state: QuoteRecipientState; direct: boolean;
  /** Contact details only when the member chose to share them; the name always. */
  name: string; phone: string | null; email: string | null;
  offer: { id: string; priceMin: number; priceMax: number | null; message: string; state: string; createdAt: string } | null;
};
/** Requests sent to the firm, newest first. Opening the inbox marks new requests as seen. */
export async function firmInbox(db: ServiceDatabase, firmId: string, at = new Date()): Promise<FirmInboxItem[]> {
  const rows = (await db.prepare("SELECT r.*,x.state AS recipient_state,o.id AS offer_id,o.price_min AS offer_min,o.price_max AS offer_max,o.message AS offer_message,o.state AS offer_state,o.created_at AS offer_at FROM service_quote_recipients x JOIN service_quote_requests r ON r.id=x.request_id LEFT JOIN service_quote_offers o ON o.request_id=x.request_id AND o.firm_id=x.firm_id WHERE x.firm_id=? ORDER BY x.created_at DESC,r.id ASC LIMIT 100").bind(firmId).all<Row>()).results || [];
  await db.prepare("UPDATE service_quote_recipients SET state='seen' WHERE firm_id=? AND state='new'").bind(firmId).run();
  return rows.map((row) => {
    const share = Number(row.share_contact) === 1 || Boolean(row.offer_id && String(row.offer_state) === "accepted");
    return {
      requestId: String(row.id), category: row.category as ServiceSlug, city: String(row.city), district: String(row.district || ""), description: String(row.description),
      timing: (Object.hasOwn(QUOTE_TIMINGS, String(row.timing)) ? row.timing : "flexible") as QuoteTiming, createdAt: String(row.created_at), expiresAt: String(row.expires_at),
      status: quoteStatus(row, at), state: (Object.hasOwn(QUOTE_RECIPIENT_LABELS, String(row.recipient_state)) ? row.recipient_state : "new") as QuoteRecipientState, direct: Boolean(row.firm_id),
      name: String(row.name), phone: share && row.phone ? String(row.phone) : null, email: share ? String(row.email) : null,
      offer: row.offer_id ? { id: String(row.offer_id), priceMin: Number(row.offer_min), priceMax: row.offer_max == null ? null : Number(row.offer_max), message: String(row.offer_message), state: String(row.offer_state), createdAt: String(row.offer_at) } : null,
    };
  });
}
export async function unseenQuotes(db: ServiceDatabase, firmId: string) {
  return Number((await db.prepare("SELECT COUNT(*) AS n FROM service_quote_recipients WHERE firm_id=? AND state='new'").bind(firmId).first<Row>())?.n) || 0;
}

async function recipientRequest(db: ServiceDatabase, firmId: string, requestId: unknown, at: Date) {
  if (typeof requestId !== "string" || !UUID.test(requestId)) throw new ServiceError("Talep bulunamadı.", 404);
  const row = await db.prepare("SELECT r.*,x.state AS recipient_state FROM service_quote_recipients x JOIN service_quote_requests r ON r.id=x.request_id WHERE x.firm_id=? AND x.request_id=?").bind(firmId, requestId).first<Row>();
  if (!row) throw new ServiceError("Talep bulunamadı.", 404);
  if (quoteStatus(row, at) !== "open") throw new ServiceError("Bu talep artık teklif kabul etmiyor.", 409);
  return row;
}
/** The firm's price offer (TL); one per request, which it may not change after sending. */
export async function sendOffer(db: ServiceDatabase, firmId: string, input: Record<string, unknown>, at = new Date()) {
  const row = await recipientRequest(db, firmId, input.requestId, at);
  const priceMin = Number(input.priceMin), priceMax = input.priceMax === null || input.priceMax === undefined || input.priceMax === "" ? null : Number(input.priceMax);
  if (!Number.isInteger(priceMin) || priceMin < 1 || priceMin > MAX_PRICE || (priceMax !== null && (!Number.isInteger(priceMax) || priceMax < priceMin || priceMax > MAX_PRICE))) throw new ServiceError("Teklif tutarını TL olarak tam sayı yazın; en yüksek tutar en düşükten küçük olamaz.");
  const message = clean(input.message);
  if (message.length < QUOTE_LIMITS.messageMin || message.length > QUOTE_LIMITS.messageMax) throw new ServiceError("Teklif açıklaması 10 ile 1500 karakter arasında olmalıdır.");
  if (await db.prepare("SELECT 1 AS ok FROM service_quote_offers WHERE request_id=? AND firm_id=?").bind(String(row.id), firmId).first()) throw new ServiceError("Bu talebe zaten teklif verdiniz.", 409);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO service_quote_offers(id,request_id,firm_id,price_min,price_max,message,state,created_at) VALUES(?,?,?,?,?,?,'sent',?)").bind(id, String(row.id), firmId, priceMin, priceMax, message, at.toISOString()).run();
  await db.prepare("UPDATE service_quote_recipients SET state='offered' WHERE request_id=? AND firm_id=?").bind(String(row.id), firmId).run();
  await countStat(db, firmId, "offer", at);
  return { id, requestId: String(row.id), userId: String(row.user_id), customerEmail: String(row.email), category: String(row.category) };
}
export async function declineQuote(db: ServiceDatabase, firmId: string, requestId: unknown, at = new Date()) {
  const row = await recipientRequest(db, firmId, requestId, at);
  if (String(row.recipient_state) === "offered") throw new ServiceError("Teklif verdiğiniz talep geçilemez.", 409);
  await db.prepare("UPDATE service_quote_recipients SET state='declined' WHERE request_id=? AND firm_id=?").bind(String(row.id), firmId).run();
  return { requestId: String(row.id) };
}

/**
 * Typical answer time in hours over the last 90 days: the median between receiving a request and
 * sending the offer. null until the firm has answered at least 3 requests.
 */
export async function responseHours(db: ServiceDatabase, firmId: string, at = new Date()) {
  const since = new Date(at.getTime() - 90 * 86400_000).toISOString();
  const rows = (await db.prepare("SELECT x.created_at AS received,o.created_at AS answered FROM service_quote_offers o JOIN service_quote_recipients x ON x.request_id=o.request_id AND x.firm_id=o.firm_id WHERE o.firm_id=? AND o.created_at>=? ORDER BY o.created_at DESC LIMIT 100").bind(firmId, since).all<Row>()).results || [];
  const hours = rows.map((row) => (Date.parse(String(row.answered)) - Date.parse(String(row.received))) / 3600_000).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (hours.length < 3) return null;
  const middle = hours.length >> 1, median = hours.length % 2 ? hours[middle] : (hours[middle - 1] + hours[middle]) / 2;
  return Math.max(1, Math.ceil(median));
}

/** "Boya badana · Kadıköy, İstanbul" for e-mails and lists. */
export const quoteSummary = (request: { category: string; city: string; district: string }) =>
  `${serviceCategory(request.category)?.name || request.category} · ${request.district ? `${request.district}, ${request.city}` : request.city}`;
