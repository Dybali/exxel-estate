// "Öneri ve geri bildirim": ideas, bug reports, complaints and thanks sent from the floating button,
// the footer link or the Hesabım card (components/FeedbackWidget.tsx). One table, site_feedback, created
// on first use; administrator replies are kept in the same row as JSON (no second table). Read and
// handled by administrators in the admin panel ("Öneriler", components/AdminFeedback.tsx).
// Must stay free of server-only imports: the widget and the admin view import the constants below.
import { emailLayout, escapeHtml } from "./email-layout";
import { consumeRateLimit, RecoveryError } from "./recovery-service";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type FeedbackDatabase = { prepare(sql: string): Statement };

export const FEEDBACK_KINDS = { idea: "Öneri / fikir", bug: "Hata bildirimi", complaint: "Şikâyet", praise: "Teşekkür" } as const;
export const FEEDBACK_TOPICS = { listings: "İlanlar", search: "Arama", posting: "İlan verme", messaging: "Mesajlaşma", services: "Hizmetler", payments: "Ödeme ve paketler", other: "Diğer" } as const;
// Workflow: new → reviewing → planned → done / declined.
export const FEEDBACK_STATUSES = { new: "Yeni", reviewing: "İnceleniyor", planned: "Planlandı", done: "Yapıldı", declined: "Yapılmayacak" } as const;
// Who sent it, decided on the server from the session (never taken from the request).
export const FEEDBACK_ROLES = { visitor: "Ziyaretçi", member: "Üye", individual: "Bireysel", agent: "Emlakçı", company: "Firma", service: "Hizmet firması", admin: "Site yöneticisi" } as const;
export const FEEDBACK_SOURCES = ["widget", "footer", "panel", "services"] as const;
export const FEEDBACK_VIEWPORTS = ["mobile", "tablet", "desktop"] as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;
export type FeedbackTopic = keyof typeof FEEDBACK_TOPICS;
export type FeedbackStatus = keyof typeof FEEDBACK_STATUSES;
export type FeedbackRole = keyof typeof FEEDBACK_ROLES;
export type FeedbackSource = typeof FEEDBACK_SOURCES[number];
export type FeedbackViewport = typeof FEEDBACK_VIEWPORTS[number] | "unknown";

export const FEEDBACK_LIMITS = {
  messageMin: 10, messageMax: 2000, emailMax: 200, noteMax: 2000, replyMin: 2, replyMax: 5000,
  // Fewer than this many milliseconds between opening the form and sending it: treated as a bot.
  minFillMs: 2500,
  perHour: 5, perDay: 20, repliesPerAdminPerHour: 30, pageSize: 20,
} as const;
const LOCALES = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl", "es", "it"];
const HOUR = 3600000, DAY = 24 * HOUR;

export const FEEDBACK_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS site_feedback(id TEXT PRIMARY KEY,kind TEXT NOT NULL,topic TEXT NOT NULL,message TEXT NOT NULL,rating INTEGER,email TEXT,source TEXT NOT NULL DEFAULT 'widget',page_path TEXT NOT NULL DEFAULT '/',locale TEXT NOT NULL DEFAULT 'tr',viewport TEXT NOT NULL DEFAULT 'unknown',user_agent TEXT NOT NULL DEFAULT 'other',user_id TEXT,role TEXT NOT NULL DEFAULT 'visitor',status TEXT NOT NULL DEFAULT 'new',admin_note TEXT NOT NULL DEFAULT '',replies TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,handled_by TEXT)",
  "CREATE INDEX IF NOT EXISTS site_feedback_status_idx ON site_feedback(status,created_at)",
  "CREATE INDEX IF NOT EXISTS site_feedback_created_idx ON site_feedback(created_at)",
];

export class FeedbackError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureFeedback(db: FeedbackDatabase) {
  let promise = ready.get(db);
  if (!promise) {
    promise = (async () => { for (const sql of FEEDBACK_SCHEMA) await db.prepare(sql).run(); })();
    ready.set(db, promise); promise.catch(() => ready.delete(db));
  }
  await promise;
}

export type FeedbackReply = { id: string; adminId: string; adminName: string | null; body: string; createdAt: string };
export type FeedbackInput = { kind: FeedbackKind; topic: FeedbackTopic; message: string; rating: number | null; email: string | null; source: FeedbackSource; pagePath: string; locale: string; viewport: FeedbackViewport };
export type Feedback = FeedbackInput & {
  id: string; userAgent: string; userId: string | null; role: FeedbackRole; status: FeedbackStatus; adminNote: string;
  replies: FeedbackReply[]; createdAt: string; updatedAt: string; handledBy: string | null;
};
// What the route knows about the request; the IP address arrives already hashed.
export type FeedbackContext = { ipHash: string; user: { id: string; email: string; role: FeedbackRole } | null; userAgent: string | null };

const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
const has = <T extends object>(map: T, value: string): value is Extract<keyof T, string> => Object.prototype.hasOwnProperty.call(map, value);
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const ID = /^[-a-f0-9]{36}$/i;

export const isFeedbackHoneypot = (input: Record<string, unknown>) => clean(input.website) !== "";

// Path only: query strings and fragments can carry personal data (search terms, tokens), so they are dropped.
export function feedbackPath(value: unknown) {
  const raw = clean(value).split(/[?#]/)[0];
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw.replace(/\s+/g, "").slice(0, 300) || "/";
}

// Browser and operating system family only ("Chrome · Android"), never the full user-agent string.
export function userAgentFamily(ua: string | null | undefined) {
  const s = String(ua || "");
  if (!s) return "other";
  if (/bot|crawl|spider|slurp|curl|wget|python|headless/i.test(s)) return "bot";
  const browser = /Edg(e|A|iOS)?\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /SamsungBrowser\//.test(s) ? "Samsung Internet" : /YaBrowser\//.test(s) ? "Yandex" : /Firefox\/|FxiOS\//.test(s) ? "Firefox" : /Chrome\/|CriOS\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "other";
  const os = /iPhone|iPad|iPod/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /CrOS/.test(s) ? "ChromeOS" : /Linux/.test(s) ? "Linux" : "other";
  return `${browser} · ${os}`;
}

// Validates the visitor's form. `accountEmail` (logged-in member) replaces whatever e-mail the form sent
// when a reply is wanted, so nobody can file feedback under another person's address while logged in.
export function validateFeedback(input: Record<string, unknown>, accountEmail: string | null = null): FeedbackInput {
  const kind = clean(input.kind), topic = clean(input.topic), message = clean(input.message).replace(/\r\n?/g, "\n");
  if (!has(FEEDBACK_KINDS, kind)) throw new FeedbackError("Geri bildirim türünü seçin.");
  if (!has(FEEDBACK_TOPICS, topic)) throw new FeedbackError("Bir konu seçin.");
  if (message.length < FEEDBACK_LIMITS.messageMin) throw new FeedbackError("Mesajınız en az 10 karakter olmalıdır.");
  if (message.length > FEEDBACK_LIMITS.messageMax) throw new FeedbackError("Mesajınız en fazla 2000 karakter olabilir.");
  let rating: number | null = null;
  if (input.rating !== undefined && input.rating !== null && input.rating !== "") {
    const value = Number(input.rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new FeedbackError("Memnuniyet puanı 1 ile 5 arasında olmalıdır.");
    rating = value;
  }
  let email: string | null = null;
  if (input.reply === true) {
    email = (accountEmail || clean(input.email)).toLowerCase();
    if (email.length > FEEDBACK_LIMITS.emailMax || !EMAIL.test(email)) throw new FeedbackError("Geçerli bir e-posta adresi girin.");
    if (input.consent !== true) throw new FeedbackError("Size yanıt verebilmemiz için e-posta adresinizin kullanılmasını onaylayın.");
  }
  const source = clean(input.source), viewport = clean(input.viewport), locale = clean(input.locale);
  return {
    kind, topic, message, rating, email,
    source: (FEEDBACK_SOURCES as readonly string[]).includes(source) ? source as FeedbackSource : "widget",
    pagePath: feedbackPath(input.path), locale: LOCALES.includes(locale) ? locale : "tr",
    viewport: (FEEDBACK_VIEWPORTS as readonly string[]).includes(viewport) ? viewport as FeedbackViewport : "unknown",
  };
}

const RATE_MESSAGE = "Kısa süre içinde çok fazla geri bildirim gönderildi. Lütfen daha sonra tekrar deneyin.";
// Hashed keys in the shared auth_limits table: per IP hash and per member, 5 an hour and 20 a day.
async function consumeLimits(db: FeedbackDatabase, context: FeedbackContext, at: Date) {
  const keys = [`feedback:ip:${context.ipHash}`, ...(context.user ? [`feedback:user:${context.user.id}`] : [])];
  try {
    for (const key of keys) {
      await consumeRateLimit(db, `${key}:hour`, FEEDBACK_LIMITS.perHour, HOUR, at, RATE_MESSAGE);
      await consumeRateLimit(db, `${key}:day`, FEEDBACK_LIMITS.perDay, DAY, at, RATE_MESSAGE);
    }
  } catch (cause) {
    if (cause instanceof RecoveryError) throw new FeedbackError(RATE_MESSAGE, 429);
    throw cause;
  }
}

// Honeypot (hidden "website" field): accepted silently and not stored (returns null). A form sent
// faster than a person can type is rejected with a message so a real (very fast) visitor can retry.
export async function submitFeedback(db: FeedbackDatabase, input: Record<string, unknown>, context: FeedbackContext, at = new Date()): Promise<Feedback | null> {
  if (isFeedbackHoneypot(input)) return null;
  const fill = Number(input.fillMs);
  if (!Number.isFinite(fill) || fill < FEEDBACK_LIMITS.minFillMs) throw new FeedbackError("Form çok hızlı gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.");
  const data = validateFeedback(input, context.user?.email || null);
  await ensureFeedback(db);
  await consumeLimits(db, context, at);
  const id = crypto.randomUUID(), createdAt = at.toISOString(), userAgent = userAgentFamily(context.userAgent);
  const role: FeedbackRole = context.user?.role || "visitor", userId = context.user?.id || null;
  await db.prepare("INSERT INTO site_feedback(id,kind,topic,message,rating,email,source,page_path,locale,viewport,user_agent,user_id,role,status,admin_note,replies,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'new','','[]',?,?)")
    .bind(id, data.kind, data.topic, data.message, data.rating, data.email, data.source, data.pagePath, data.locale, data.viewport, userAgent, userId, role, createdAt, createdAt).run();
  return { ...data, id, userAgent, userId, role, status: "new", adminNote: "", replies: [], createdAt, updatedAt: createdAt, handledBy: null };
}

type RoleDatabase = { prepare(sql: string): { bind(...values: (string | number | null)[]): { first<T = Record<string, unknown>>(): Promise<T | null> } } };
// Role of a logged-in member: agent accounts are "company" when their agency is a developer, other
// members "service" when they run a service firm (Hizmetler). Lazily created tables may not exist yet.
export async function feedbackRole(db: RoleDatabase, user: { id: string; role: string }, admin = false): Promise<FeedbackRole> {
  if (admin || user.role === "admin") return "admin";
  const optional = async (sql: string) => { try { return Boolean(await db.prepare(sql).bind(String(user.id)).first()); } catch { return false; } };
  if (user.role === "agent") return await optional("SELECT 1 AS found FROM agencies WHERE CAST(owner_id AS TEXT)=? AND category='developer'") ? "company" : "agent";
  if (await optional("SELECT 1 AS found FROM service_firms WHERE owner_id=?")) return "service";
  return user.role === "individual" ? "individual" : "member";
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? "" : String(value);
function parseReplies(value: unknown): FeedbackReply[] {
  try {
    const list = JSON.parse(text(value) || "[]");
    return Array.isArray(list) ? list.filter((item) => item && typeof item.body === "string").map((item) => ({ id: text(item.id), adminId: text(item.adminId), adminName: item.adminName == null ? null : text(item.adminName), body: text(item.body), createdAt: text(item.createdAt) })) : [];
  } catch { return []; }
}
export const toFeedback = (row: Row): Feedback => ({
  id: text(row.id), kind: (has(FEEDBACK_KINDS, text(row.kind)) ? row.kind : "idea") as FeedbackKind, topic: (has(FEEDBACK_TOPICS, text(row.topic)) ? row.topic : "other") as FeedbackTopic,
  message: text(row.message), rating: row.rating == null ? null : Number(row.rating), email: row.email == null || row.email === "" ? null : text(row.email),
  source: ((FEEDBACK_SOURCES as readonly string[]).includes(text(row.source)) ? row.source : "widget") as FeedbackSource, pagePath: text(row.page_path) || "/", locale: text(row.locale) || "tr",
  viewport: ((FEEDBACK_VIEWPORTS as readonly string[]).includes(text(row.viewport)) ? row.viewport : "unknown") as FeedbackViewport, userAgent: text(row.user_agent) || "other",
  userId: row.user_id == null ? null : text(row.user_id), role: (has(FEEDBACK_ROLES, text(row.role)) ? row.role : "visitor") as FeedbackRole,
  status: (has(FEEDBACK_STATUSES, text(row.status)) ? row.status : "new") as FeedbackStatus, adminNote: text(row.admin_note), replies: parseReplies(row.replies),
  createdAt: text(row.created_at), updatedAt: text(row.updated_at), handledBy: row.handled_by == null ? null : text(row.handled_by),
});

export type FeedbackFilters = { status?: unknown; kind?: unknown; topic?: unknown; role?: unknown; hasEmail?: unknown; q?: unknown; page?: unknown };
// Admin list with filters, search and pagination, newest first. Also returns the number of new items.
export async function adminFeedbackList(db: FeedbackDatabase, filters: FeedbackFilters = {}) {
  await ensureFeedback(db);
  const where: string[] = [], values: (string | number)[] = [];
  const pick = (column: string, map: object, value: unknown) => { const v = clean(value); if (v && has(map, v)) { where.push(`${column}=?`); values.push(v); } };
  pick("status", FEEDBACK_STATUSES, filters.status); pick("kind", FEEDBACK_KINDS, filters.kind); pick("topic", FEEDBACK_TOPICS, filters.topic); pick("role", FEEDBACK_ROLES, filters.role);
  const hasEmail = clean(filters.hasEmail);
  if (hasEmail === "1" || hasEmail === "true") where.push("email IS NOT NULL");
  if (hasEmail === "0" || hasEmail === "false") where.push("email IS NULL");
  const q = clean(filters.q).slice(0, 100).toLowerCase();
  if (q) { where.push("(LOWER(message) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(email,'')) LIKE ? ESCAPE '\\' OR LOWER(page_path) LIKE ? ESCAPE '\\')"); const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`; values.push(like, like, like); }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const pageSize = FEEDBACK_LIMITS.pageSize, page = Math.max(1, Math.min(10000, Math.floor(Number(filters.page) || 1)));
  const [rows, total, open] = await Promise.all([
    db.prepare(`SELECT * FROM site_feedback${clause} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, (page - 1) * pageSize).all<Row>(),
    db.prepare(`SELECT COUNT(*) AS n FROM site_feedback${clause}`).bind(...values).first<{ n: number | string }>(),
    db.prepare("SELECT COUNT(*) AS n FROM site_feedback WHERE status='new'").first<{ n: number | string }>(),
  ]);
  return { items: rows.results.map(toFeedback), total: Number(total?.n || 0), page, pageSize, newCount: Number(open?.n || 0) };
}

// Overview card: last 30 days. Average satisfaction over the rated items, counts by type, top topics.
export async function feedbackSummary(db: FeedbackDatabase, at = new Date()) {
  await ensureFeedback(db);
  const since = new Date(at.getTime() - 30 * DAY).toISOString();
  const [rating, kinds, topics, open] = await Promise.all([
    db.prepare("SELECT AVG(rating) AS avg,COUNT(rating) AS rated,COUNT(*) AS total FROM site_feedback WHERE created_at>=?").bind(since).first<Row>(),
    db.prepare("SELECT kind,COUNT(*) AS n FROM site_feedback WHERE created_at>=? GROUP BY kind").bind(since).all<Row>(),
    db.prepare("SELECT topic,COUNT(*) AS n FROM site_feedback WHERE created_at>=? GROUP BY topic ORDER BY n DESC,topic LIMIT 3").bind(since).all<Row>(),
    db.prepare("SELECT COUNT(*) AS n FROM site_feedback WHERE status='new'").first<Row>(),
  ]);
  const byKind = Object.fromEntries(Object.keys(FEEDBACK_KINDS).map((kind) => [kind, Number(kinds.results.find((r) => r.kind === kind)?.n || 0)])) as Record<FeedbackKind, number>;
  const rated = Number(rating?.rated || 0);
  return {
    since, total: Number(rating?.total || 0), rated, averageRating: rated ? Math.round(Number(rating?.avg) * 10) / 10 : null, byKind,
    topTopics: topics.results.filter((r) => has(FEEDBACK_TOPICS, text(r.topic))).map((r) => ({ topic: text(r.topic) as FeedbackTopic, count: Number(r.n || 0) })),
    newCount: Number(open?.n || 0),
  };
}

type Admin = { id: string; name?: string | null };
const audit = (db: FeedbackDatabase, admin: Admin, action: string, id: string, summary: string, at: string) =>
  db.prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), admin.id, String(admin.name || "").slice(0, 200), action, id, summary.slice(0, 500), at).run();

// Status change and/or internal note, recorded in the admin audit log.
export async function updateFeedback(db: FeedbackDatabase, admin: Admin, input: Record<string, unknown>, at = new Date()) {
  const id = input.id;
  if (typeof id !== "string" || !ID.test(id)) throw new FeedbackError("Geçersiz istek.");
  const status = input.status === undefined ? undefined : clean(input.status);
  if (status !== undefined && !has(FEEDBACK_STATUSES, status)) throw new FeedbackError("Geçersiz durum.");
  const note = input.note === undefined ? undefined : clean(input.note).replace(/\r\n?/g, "\n");
  if (note !== undefined && note.length > FEEDBACK_LIMITS.noteMax) throw new FeedbackError("Not en fazla 2000 karakter olabilir.");
  if (status === undefined && note === undefined) throw new FeedbackError("Geçersiz istek.");
  await ensureFeedback(db);
  const before = await db.prepare("SELECT * FROM site_feedback WHERE id=?").bind(id).first<Row>();
  if (!before) throw new FeedbackError("Geri bildirim bulunamadı.", 404);
  const stamp = at.toISOString(), nextStatus = status ?? text(before.status), nextNote = note ?? text(before.admin_note);
  const row = await db.prepare("UPDATE site_feedback SET status=?,admin_note=?,updated_at=?,handled_by=? WHERE id=? RETURNING *").bind(nextStatus, nextNote, stamp, admin.id, id).first<Row>();
  const changes = [status !== undefined && status !== text(before.status) ? `${text(before.status)} → ${status}` : "", note !== undefined && note !== text(before.admin_note) ? "not güncellendi" : ""].filter(Boolean);
  if (changes.length) await audit(db, admin, "feedback_status", id, changes.join(" · "), stamp);
  return toFeedback(row || before);
}

export type FeedbackMail = { to: string; subject: string; html: string; text: string };
export type FeedbackSender = (mail: FeedbackMail) => Promise<{ sent: boolean; reason?: string; provider?: string; messageId?: string }>;
const KIND_EN: Record<FeedbackKind, string> = { idea: "Suggestion", bug: "Bug report", complaint: "Complaint", praise: "Thanks" };
const stamp = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`; };

// Reply e-mail to the sender: the answer, a signature, then their feedback quoted (same layout as contact replies).
export function feedbackReplyEmail(item: Feedback, reply: string, siteUrl: string): FeedbackMail {
  const when = stamp(item.createdAt), quoteHead = `${when} tarihli geri bildiriminiz / Your feedback of ${when}:`;
  const lines = [
    escapeHtml(reply).replace(/\n/g, "<br>"),
    `EstateMarket24<br><a href="${escapeHtml(siteUrl)}" style="color:#17334b">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a>`,
    `<span style="display:block;margin-top:18px;color:#7c887f;font-size:13px">${escapeHtml(quoteHead)}</span><span style="display:block;border-left:3px solid #d7dfdb;padding:4px 0 4px 12px;color:#55615a;font-size:13px">${escapeHtml(item.message).replace(/\n/g, "<br>")}</span>`,
  ];
  return {
    to: item.email || "", subject: `Re: estatemarket24: ${FEEDBACK_KINDS[item.kind]} / ${KIND_EN[item.kind]}`,
    html: emailLayout({ title: "Geri bildiriminize yanıt", titleEn: "Reply to your feedback", lines }),
    text: `${reply}\n\n-- \nEstateMarket24\n${siteUrl}\n\n${quoteHead}\n${item.message.split("\n").map((line) => `> ${line}`).join("\n")}\n`,
  };
}

// Sends the reply, appends it to the row's replies JSON, moves a new item to "reviewing" and audits it.
// Nothing is stored when sending fails; "not_configured" becomes a 503 the panel explains.
export async function replyToFeedback(db: FeedbackDatabase, admin: Admin, input: Record<string, unknown>, send: FeedbackSender, siteUrl: string, at = new Date()) {
  const id = input.id, body = clean(input.text).replace(/\r\n?/g, "\n");
  if (typeof id !== "string" || !ID.test(id)) throw new FeedbackError("Geçersiz istek.");
  if (body.length < FEEDBACK_LIMITS.replyMin) throw new FeedbackError("Yanıt metnini yazın.");
  if (body.length > FEEDBACK_LIMITS.replyMax) throw new FeedbackError("Yanıt en fazla 5000 karakter olabilir.");
  await ensureFeedback(db);
  const row = await db.prepare("SELECT * FROM site_feedback WHERE id=?").bind(id).first<Row>();
  if (!row) throw new FeedbackError("Geri bildirim bulunamadı.", 404);
  const item = toFeedback(row);
  if (!item.email) throw new FeedbackError("Bu geri bildirimde e-posta adresi yok.");
  try { await consumeRateLimit(db, `feedback-reply:${admin.id}`, FEEDBACK_LIMITS.repliesPerAdminPerHour, HOUR, at); }
  catch (cause) { if (cause instanceof RecoveryError) throw new FeedbackError("Bir saat içinde çok fazla yanıt gönderildi. Lütfen biraz sonra tekrar deneyin.", 429); throw cause; }
  const result = await send(feedbackReplyEmail(item, body, siteUrl));
  if (!result.sent) {
    if (result.reason === "not_configured") throw new FeedbackError("E-posta gönderimi yapılandırılmamış. Yanıtı e-posta programınızdan gönderin.", 503);
    throw new FeedbackError("Yanıt gönderilemedi. E-posta ayarlarını kontrol edin veya e-posta programınızdan yanıtlayın.", 502);
  }
  const createdAt = at.toISOString();
  const replies = [...item.replies, { id: crypto.randomUUID(), adminId: admin.id, adminName: admin.name ? String(admin.name).slice(0, 200) : null, body, createdAt, provider: result.provider || null, messageId: result.messageId ? String(result.messageId).slice(0, 300) : null }];
  const status = item.status === "new" ? "reviewing" : item.status;
  const updated = await db.prepare("UPDATE site_feedback SET replies=?,status=?,updated_at=?,handled_by=? WHERE id=? RETURNING *").bind(JSON.stringify(replies), status, createdAt, admin.id, id).first<Row>();
  await audit(db, admin, "feedback_reply", id, `E-posta yanıtı · ${item.email}`, createdAt);
  return toFeedback(updated || row);
}

// Short notice for the site administrator. No e-mail of the sender in the subject; Reply-To is set by the route.
export function feedbackNotice(item: Feedback, siteUrl: string) {
  const kind = FEEDBACK_KINDS[item.kind], topic = FEEDBACK_TOPICS[item.topic];
  const meta = [`${kind} · ${topic}`, `${FEEDBACK_ROLES[item.role]} · ${item.locale.toUpperCase()} · ${item.viewport}`, `Sayfa / Page: ${item.pagePath}`, item.rating ? `Memnuniyet / Rating: ${item.rating}/5` : ""].filter(Boolean);
  const excerpt = item.message.length > 600 ? item.message.slice(0, 600) + "…" : item.message;
  return {
    subject: `Geri bildirim: ${kind} · ${topic} / Feedback`,
    html: emailLayout({ title: "Yeni geri bildirim", titleEn: "New feedback", lines: [...meta.map(escapeHtml), escapeHtml(excerpt).replace(/\n/g, "<br>")], action: { href: `${siteUrl}/yonetim?view=feedback`, label: "Yönetimde aç / Open in admin" } }),
    text: `${meta.join("\n")}\n\n${excerpt}\n\n${siteUrl}/yonetim?view=feedback`,
  };
}
