// Messages sent through the public contact form (/iletisim). Stored in contact_messages, created
// on first use, and read by administrators in the admin panel ("İletişim mesajları").
import { emailLayout, escapeHtml } from "./email";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type ContactDatabase = { prepare(sql: string): Statement };

export const CONTACT_SUBJECTS = {
  general: "Genel soru",
  listing: "İlan ile ilgili",
  agency: "Emlak ofisi ve kurumsal üyelik",
  technical: "Teknik sorun",
  privacy: "Kişisel veriler (KVKK)",
  other: "Diğer",
} as const;
export type ContactSubject = keyof typeof CONTACT_SUBJECTS;
export const CONTACT_LIMITS = { nameMax: 100, emailMax: 200, messageMin: 10, messageMax: 2000, perEmailPerDay: 5, perHour: 30 } as const;
const LOCALES = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl"];

export const CONTACT_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS contact_messages(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,user_id TEXT,locale TEXT NOT NULL DEFAULT 'tr',status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL,handled_at TEXT,handled_by TEXT)",
  "CREATE INDEX IF NOT EXISTS contact_messages_email_idx ON contact_messages(email,created_at)",
  "CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages(created_at)",
];

export class ContactError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: ContactDatabase) {
  let promise = ready.get(db);
  if (!promise) {
    promise = (async () => { for (const sql of CONTACT_SCHEMA) await db.prepare(sql).run(); })();
    ready.set(db, promise); promise.catch(() => ready.delete(db));
  }
  await promise;
}

export type ContactInput = { name: string; email: string; subject: ContactSubject; message: string; locale: string };
export type ContactMessage = ContactInput & { id: string; userId: string | null; status: "new" | "handled"; createdAt: string; handledAt: string | null };

const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
const isSubject = (value: string): value is ContactSubject => Object.prototype.hasOwnProperty.call(CONTACT_SUBJECTS, value);
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

// True when the hidden "website" field was filled in: such requests are accepted but not stored.
export const isHoneypot = (input: Record<string, unknown>) => clean(input.website) !== "";

export function validateContact(input: Record<string, unknown>): ContactInput {
  const name = clean(input.name).replace(/\s+/g, " "), email = clean(input.email).toLowerCase(), message = clean(input.message);
  const subject = clean(input.subject), locale = clean(input.locale);
  if (name.length < 2 || name.length > CONTACT_LIMITS.nameMax) throw new ContactError("Adınızı ve soyadınızı girin.");
  if (email.length > CONTACT_LIMITS.emailMax || !EMAIL.test(email)) throw new ContactError("Geçerli bir e-posta adresi girin.");
  if (!isSubject(subject)) throw new ContactError("Bir konu seçin.");
  if (message.length < CONTACT_LIMITS.messageMin) throw new ContactError("Mesajınız en az 10 karakter olmalıdır.");
  if (message.length > CONTACT_LIMITS.messageMax) throw new ContactError("Mesajınız en fazla 2000 karakter olabilir.");
  if (input.consent !== true) throw new ContactError("Devam etmek için kişisel verilerin işlenmesini onaylayın.");
  return { name, email, subject: subject as ContactSubject, message, locale: LOCALES.includes(locale) ? locale : "tr" };
}

// Validates, applies the rate limits and stores the message. Returns null for honeypot requests.
export async function submitContact(db: ContactDatabase, input: Record<string, unknown>, userId: string | null = null, at = new Date()): Promise<ContactMessage | null> {
  if (isHoneypot(input)) return null;
  const data = validateContact(input);
  await ensure(db);
  const day = new Date(at.getTime() - 86400000).toISOString(), hour = new Date(at.getTime() - 3600000).toISOString();
  const [byEmail, overall] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE email=? AND created_at>?").bind(data.email, day).first<{ n: number | string }>(),
    db.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE created_at>?").bind(hour).first<{ n: number | string }>(),
  ]);
  if (Number(byEmail?.n || 0) >= CONTACT_LIMITS.perEmailPerDay) throw new ContactError("Bu e-posta adresiyle bugün çok fazla mesaj gönderildi. Lütfen yarın tekrar deneyin.", 429);
  if (Number(overall?.n || 0) >= CONTACT_LIMITS.perHour) throw new ContactError("Şu anda çok fazla mesaj alıyoruz. Lütfen biraz sonra tekrar deneyin.", 429);
  const id = crypto.randomUUID(), createdAt = at.toISOString();
  await db.prepare("INSERT INTO contact_messages(id,name,email,subject,message,user_id,locale,status,created_at) VALUES(?,?,?,?,?,?,?,'new',?)")
    .bind(id, data.name, data.email, data.subject, data.message, userId, data.locale, createdAt).run();
  return { ...data, id, userId, status: "new", createdAt, handledAt: null };
}

type Row = { id: string; name: string; email: string; subject: string; message: string; user_id: string | null; locale: string; status: string; created_at: string; handled_at: string | null };
const toMessage = (row: Row): ContactMessage => ({
  id: String(row.id), name: String(row.name), email: String(row.email), subject: (isSubject(row.subject) ? row.subject : "other") as ContactSubject,
  message: String(row.message), userId: row.user_id == null ? null : String(row.user_id), locale: String(row.locale), status: row.status === "handled" ? "handled" : "new",
  createdAt: String(row.created_at), handledAt: row.handled_at == null ? null : String(row.handled_at),
});

// Newest first; `status` filters to new or handled messages. Also returns the number of new ones.
export async function adminContactMessages(db: ContactDatabase, status: unknown = "all", limit = 200) {
  await ensure(db);
  const filter = status === "new" || status === "handled" ? status : null;
  const [rows, open] = await Promise.all([
    (filter ? db.prepare("SELECT * FROM contact_messages WHERE status=? ORDER BY created_at DESC LIMIT ?").bind(filter, limit) : db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ?").bind(limit)).all<Row>(),
    db.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status='new'").first<{ n: number | string }>(),
  ]);
  return { messages: rows.results.map(toMessage), newCount: Number(open?.n || 0) };
}

export async function setContactHandled(db: ContactDatabase, adminId: string, id: unknown, handled: unknown, at = new Date()) {
  if (typeof id !== "string" || !/^[-a-f0-9]{36}$/i.test(id) || typeof handled !== "boolean") throw new ContactError("Geçersiz istek.");
  await ensure(db);
  const row = handled
    ? await db.prepare("UPDATE contact_messages SET status='handled',handled_at=?,handled_by=? WHERE id=? RETURNING *").bind(at.toISOString(), adminId, id).first<Row>()
    : await db.prepare("UPDATE contact_messages SET status='new',handled_at=NULL,handled_by=NULL WHERE id=? RETURNING *").bind(id).first<Row>();
  if (!row) throw new ContactError("Mesaj bulunamadı.", 404);
  return toMessage(row);
}

// Notification for the site administrator; the visitor's address goes in the text so a reply is one click.
export function contactNotice(message: ContactMessage, siteUrl: string) {
  const subject = CONTACT_SUBJECTS[message.subject];
  const lines = [
    `<strong>${escapeHtml(message.name)}</strong> &lt;<a href="mailto:${escapeHtml(message.email)}">${escapeHtml(message.email)}</a>&gt;`,
    `Konu / Subject: ${escapeHtml(subject)} · ${escapeHtml(message.locale.toUpperCase())}`,
    escapeHtml(message.message).replace(/\n/g, "<br>"),
  ];
  return {
    subject: `İletişim formu: ${subject} / Contact form`,
    html: emailLayout({ title: "Yeni iletişim mesajı", titleEn: "New contact form message", lines, action: { href: `${siteUrl}/yonetim?view=contact`, label: "Yönetimde aç / Open in admin" } }),
    text: `${message.name} <${message.email}>\nKonu / Subject: ${subject}\n\n${message.message}\n\n${siteUrl}/yonetim?view=contact`,
  };
}
