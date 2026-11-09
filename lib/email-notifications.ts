import { emailLayout, emailReady, escapeHtml, sendEmail, type EmailSettings } from "./email";
import { searchSql } from "./search-filters";
import type { RateSnapshot } from "./tcmb";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type NotificationDatabase = { prepare(sql: string): Statement };
export type Settings = EmailSettings & { SITE_URL: string };

// messages: new-message emails (on by default, transactional). alerts: daily digest (off until the user opts in).
export const EMAIL_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS email_preferences(user_id TEXT PRIMARY KEY,messages INTEGER NOT NULL DEFAULT 1,alerts INTEGER NOT NULL DEFAULT 0,token TEXT NOT NULL UNIQUE,alerts_sent_at TEXT,updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS email_log(log_key TEXT PRIMARY KEY,sent_at TEXT NOT NULL)",
];
export const MESSAGE_EMAIL_GAP_MINUTES = 30;

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: NotificationDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of EMAIL_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function emailPreferences(db: NotificationDatabase, userId: string, at = new Date()) {
  await ensure(db);
  await db.prepare("INSERT INTO email_preferences(user_id,token,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId, randomToken(), at.toISOString()).run();
  const row = await db.prepare("SELECT messages,alerts,token,alerts_sent_at FROM email_preferences WHERE user_id=?").bind(userId).first<{ messages: number; alerts: number; token: string; alerts_sent_at: string | null }>();
  return { messages: Number(row?.messages) === 1, alerts: Number(row?.alerts) === 1, token: String(row?.token || ""), alertsSentAt: row?.alerts_sent_at || null };
}

export async function setEmailPreferences(db: NotificationDatabase, userId: string, input: Record<string, unknown>, at = new Date()) {
  const current = await emailPreferences(db, userId, at);
  const messages = typeof input.messages === "boolean" ? input.messages : current.messages;
  const alerts = typeof input.alerts === "boolean" ? input.alerts : current.alerts;
  // Turning alerts on starts the digest window now, so old matches are not mailed.
  const sentAt = alerts && !current.alerts ? at.toISOString() : current.alertsSentAt;
  await db.prepare("UPDATE email_preferences SET messages=?,alerts=?,alerts_sent_at=?,updated_at=? WHERE user_id=?").bind(messages ? 1 : 0, alerts ? 1 : 0, sentAt, at.toISOString(), userId).run();
  return { messages, alerts };
}

export async function unsubscribe(db: NotificationDatabase, token: string, kind: string, at = new Date()) {
  if (!/^[a-f0-9]{48}$/.test(token) || !["messages", "alerts", "all"].includes(kind)) return false;
  await ensure(db);
  const sets = kind === "all" ? "messages=0,alerts=0" : `${kind}=0`;
  const row = await db.prepare(`UPDATE email_preferences SET ${sets},updated_at=? WHERE token=? RETURNING user_id`).bind(at.toISOString(), token).first();
  return Boolean(row);
}

export const unsubscribeUrl = (settings: Settings, token: string, kind: string) => `${settings.SITE_URL}/api/email/unsubscribe?token=${token}&type=${kind}`;

// One email per conversation at most every 30 minutes; returns why nothing was sent.
export async function notifyNewMessage(db: NotificationDatabase, settings: Settings, message: { listingId: string; senderId: string; recipientId: string }, at = new Date()) {
  if (!emailReady(settings)) return "not_configured";
  await ensure(db);
  const recipient = await db.prepare("SELECT email,email_verified FROM users WHERE id=?").bind(message.recipientId).first<{ email: string; email_verified: number }>();
  if (!recipient?.email || !Number(recipient.email_verified)) return "no_recipient";
  const prefs = await emailPreferences(db, message.recipientId, at);
  if (!prefs.messages) return "opted_out";
  const key = `msg:${message.listingId}:${message.senderId}:${message.recipientId}`;
  const since = new Date(at.getTime() - MESSAGE_EMAIL_GAP_MINUTES * 60000).toISOString();
  const claimed = await db.prepare("INSERT INTO email_log(log_key,sent_at) VALUES(?,?) ON CONFLICT(log_key) DO UPDATE SET sent_at=excluded.sent_at WHERE email_log.sent_at<? RETURNING log_key").bind(key, at.toISOString(), since).first();
  if (!claimed) return "throttled";
  const sender = await db.prepare("SELECT name FROM users WHERE id=?").bind(message.senderId).first<{ name: string }>();
  const listing = message.listingId.startsWith("admin:") ? null : await db.prepare("SELECT title FROM listings WHERE CAST(id AS TEXT)=?").bind(message.listingId).first<{ title: string }>();
  const name = sender?.name || "estatemarket24", about = listing?.title ? ` · ${listing.title}` : "";
  const link = `${settings.SITE_URL}/hesabim?tab=mesajlar&listingId=${encodeURIComponent(message.listingId)}&peerId=${encodeURIComponent(message.senderId)}`;
  const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages");
  const result = await sendEmail(settings, {
    to: recipient.email,
    subject: `Yeni mesaj / New message: ${name}${about}`.slice(0, 180),
    html: emailLayout({ title: "Yeni mesajınız var", titleEn: "You have a new message", lines: [`<strong>${escapeHtml(name)}</strong>${escapeHtml(about)}`, "Mesajı okumak ve yanıtlamak için hesabınıza giriş yapın. / Sign in to read and reply."], action: { href: link, label: "Mesajı aç / Open message" }, unsubscribeUrl: unsubscribe }),
    text: `Yeni mesaj / New message: ${name}${about}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
    unsubscribeUrl: unsubscribe,
  });
  return result.sent ? "sent" : result.reason;
}

// Daily digest of new saved-search matches and price changes on favourites for opted-in users.
/** `rates`: TCMB snapshot for saved searches with a price range (lib/search-filters.ts). */
export async function sendDailyDigests(db: NotificationDatabase, settings: Settings, at = new Date(), limit = 500, rates: RateSnapshot | null = null) {
  if (!emailReady(settings)) return { users: 0, sent: 0 };
  await ensure(db);
  const now = at.toISOString();
  const users = await db.prepare("SELECT p.user_id,p.token,p.alerts_sent_at,u.email FROM email_preferences p JOIN users u ON CAST(u.id AS TEXT)=p.user_id WHERE p.alerts=1 AND u.email_verified=1 LIMIT ?").bind(limit).all<{ user_id: string; token: string; alerts_sent_at: string | null; email: string }>();
  let sent = 0;
  for (const user of users.results) {
    const since = user.alerts_sent_at || new Date(at.getTime() - 86400000).toISOString();
    const searches = await db.prepare("SELECT name,query FROM saved_searches WHERE user_id=? AND enabled=1 LIMIT 10").bind(user.user_id).all<{ name: string; query: string }>().catch(() => ({ results: [] as { name: string; query: string }[] }));
    const lines: string[] = [];
    for (const search of searches.results) {
      const filter = searchSql(search.query, rates);
      const row = await db.prepare(`SELECT count(*) AS n FROM listings l WHERE ${filter.where} AND l.published_at>? AND l.published_at<=?`).bind(...filter.values, since, now).first<{ n: number }>();
      if (Number(row?.n)) lines.push(`<a href="${escapeHtml(`${settings.SITE_URL}/ilanlar?${search.query}`)}">${escapeHtml(search.name)}</a>: ${Number(row!.n)} yeni ilan / new listings`);
    }
    const drops = await db.prepare("SELECT l.id,l.title,h.old_price,h.new_price,h.currency FROM price_history h JOIN listings l ON l.id=h.listing_id JOIN favorites f ON f.listing_id=CAST(l.id AS TEXT) WHERE f.user_id=? AND l.status='published' AND h.new_price<>h.old_price AND h.changed_at>? AND h.changed_at<=? LIMIT 10").bind(user.user_id, since, now).all<{ id: string; title: string; old_price: number; new_price: number; currency: string }>().catch(() => ({ results: [] as { id: string; title: string; old_price: number; new_price: number; currency: string }[] }));
    for (const drop of drops.results) lines.push(`<a href="${escapeHtml(`${settings.SITE_URL}/ilan/${drop.id}`)}">${escapeHtml(drop.title)}</a>: ${Number(drop.old_price).toLocaleString("tr-TR")} → ${Number(drop.new_price).toLocaleString("tr-TR")} ${escapeHtml(drop.currency)}`);
    if (lines.length) {
      const unsubscribe = unsubscribeUrl(settings, user.token, "alerts");
      const result = await sendEmail(settings, {
        to: user.email, subject: "Aramalarınızda yenilikler / Updates to your searches",
        html: emailLayout({ title: "Aramalarınızda yenilikler", titleEn: "Updates to your searches and favourites", lines, action: { href: `${settings.SITE_URL}/hesabim?tab=bildirimler`, label: "Bildirimleri aç / Open alerts" }, unsubscribeUrl: unsubscribe }),
        text: lines.map((line) => line.replace(/<[^>]+>/g, "")).join("\n") + `\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`, unsubscribeUrl: unsubscribe,
      }).catch(() => ({ sent: false as const }));
      if (result.sent) sent++;
    }
    await db.prepare("UPDATE email_preferences SET alerts_sent_at=? WHERE user_id=?").bind(now, user.user_id).run();
  }
  return { users: users.results.length, sent };
}

// New reservation request for a project ("yer ayırtma talebi"); follows the owner's message-email preference.
export async function notifyProjectReservation(db: NotificationDatabase, settings: Settings, request: { ownerId: string; projectName: string; unitType: string; name: string }, at = new Date()) {
  if (!emailReady(settings)) return "not_configured";
  await ensure(db);
  const owner = await db.prepare("SELECT email,email_verified FROM users WHERE CAST(id AS TEXT)=?").bind(request.ownerId).first<{ email: string; email_verified: number }>();
  if (!owner?.email || !Number(owner.email_verified)) return "no_recipient";
  const prefs = await emailPreferences(db, request.ownerId, at);
  if (!prefs.messages) return "opted_out";
  const link = `${settings.SITE_URL}/hesabim?tab=projelerim`;
  const unsubscribe = unsubscribeUrl(settings, prefs.token, "messages");
  const about = `${request.projectName} · ${request.unitType}`;
  const result = await sendEmail(settings, {
    to: owner.email,
    subject: `Yeni yer ayırtma talebi / New reservation request: ${about}`.slice(0, 180),
    html: emailLayout({ title: "Yeni yer ayırtma talebi", titleEn: "New reservation request", lines: [`<strong>${escapeHtml(request.name)}</strong> · ${escapeHtml(about)}`, "Talebi görmek ve yanıtlamak için hesabınıza giriş yapın. / Sign in to view and answer the request."], action: { href: link, label: "Talepleri aç / Open requests" }, unsubscribeUrl: unsubscribe }),
    text: `Yeni yer ayırtma talebi / New reservation request: ${request.name} · ${about}\n${link}\n\nAbonelikten çık / Unsubscribe: ${unsubscribe}`,
    unsubscribeUrl: unsubscribe,
  });
  return result.sent ? "sent" : result.reason;
}
