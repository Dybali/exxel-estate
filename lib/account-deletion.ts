// Members' own data rights (KVKK art. 11, GDPR art. 15, 17, 20): download their data and delete their
// account themselves. Deletion removes the member's listings (with photos, through the caller), saved
// searches, favourites, drafts, preferences, sign-in links and sessions, and anonymises the users row
// instead of deleting it, so conversations, appointments and records other people keep stay consistent
// (the other side sees "Silinmiş hesap"). Company owners (estate agency, contractor or service firm)
// and administrators are not deleted here: their records involve other people and are handled on request.
type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
export type AccountDatabase = { prepare(sql: string): Statement };
export type OwnedListing = { id: string; images: string | null; presentation: string | null };
export class AccountDeletionError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const DELETED_NAME = "Silinmiş hesap";
export const deletedEmail = (userId: string) => `deleted+${userId}@deleted.invalid`;

// Tables created on first use may not exist yet; a missing table means there is nothing to read or delete.
async function optional<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try { return await work(); } catch { return fallback; }
}

export async function deletionBlocker(db: AccountDatabase, user: { id: string; role: string }) {
  if (user.role === "admin") return "Yönetici hesapları buradan silinemez.";
  const owns = async (sql: string) => Boolean(await optional(() => db.prepare(sql).bind(String(user.id)).first(), null));
  if (await owns("SELECT 1 AS found FROM agencies WHERE CAST(owner_id AS TEXT)=? LIMIT 1")
    || await owns("SELECT 1 AS found FROM contractor_firms WHERE owner_id=? LIMIT 1")
    || await owns("SELECT 1 AS found FROM service_firms WHERE owner_id=? LIMIT 1"))
    return "Şirket hesaplarının silinmesi için bize iletişim sayfasından yazın.";
  return null;
}

export async function deleteAccount(db: AccountDatabase, user: { id: string; role: string; email: string }, removeListing: (listing: OwnedListing) => Promise<void>, removeAvatar: (url: string) => Promise<void>, passwordPlaceholder: string, at = new Date()) {
  const blocker = await deletionBlocker(db, user);
  if (blocker) throw new AccountDeletionError(blocker, 409);
  const id = String(user.id), stamp = at.toISOString();
  const listings = await db.prepare("SELECT id,images,presentation FROM listings WHERE owner_id=?").bind(id).all<OwnedListing>();
  for (const listing of listings.results) await removeListing(listing);
  const avatar = await db.prepare("SELECT avatar_url FROM users WHERE id=?").bind(id).first<{ avatar_url: string | null }>();
  if (avatar?.avatar_url) await removeAvatar(avatar.avatar_url).catch(() => {});
  for (const sql of [
    "DELETE FROM favorites WHERE user_id=?", "DELETE FROM saved_searches WHERE user_id=?", "DELETE FROM discovery_preferences WHERE user_id=?",
    "DELETE FROM seller_profiles WHERE user_id=?", "DELETE FROM listing_drafts WHERE user_id=?", "DELETE FROM oauth_accounts WHERE user_id=?",
    "DELETE FROM email_preferences WHERE user_id=?", "DELETE FROM account_kinds WHERE user_id=?",
  ]) await optional(() => db.prepare(sql).bind(id).run(), null);
  await optional(() => db.prepare("UPDATE company_team_memberships SET ended_at=? WHERE user_id=? AND ended_at IS NULL").bind(stamp, id).run(), null);
  await optional(() => db.prepare("DELETE FROM email_codes WHERE email=?").bind(String(user.email).toLowerCase()).run(), null);
  await db.prepare("UPDATE users SET email=?,name=?,phone=NULL,whatsapp_enabled=0,company=NULL,avatar_url=NULL,password_hash=?,email_verified=0 WHERE id=?")
    .bind(deletedEmail(id), DELETED_NAME, passwordPlaceholder, id).run();
  await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  return { listings: listings.results.length };
}

// Everything the member gave us or created, as one JSON document. No password hash, no internal notes.
export async function exportAccount(db: AccountDatabase, userId: string, at = new Date()) {
  const id = String(userId);
  const rows = (sql: string, ...values: unknown[]) => optional(async () => (await db.prepare(sql).bind(...values).all<Record<string, unknown>>()).results, [] as Record<string, unknown>[]);
  const profile = await db.prepare("SELECT id,email,email_verified,name,phone,whatsapp_enabled,role,agent_status,company,avatar_url,created_at FROM users WHERE id=?").bind(id).first<Record<string, unknown>>();
  return {
    exportedAt: at.toISOString(),
    profile,
    sellerProfile: (await rows("SELECT bio,updated_at FROM seller_profiles WHERE user_id=?", id))[0] || null,
    listings: await rows("SELECT id,title,description,purpose,property_type,price,currency,city,district,neighborhood,gross_area,net_area,rooms,bedrooms,bathrooms,building_age,floor,total_floors,heating,furnished,amenities,images,status,created_at,updated_at FROM listings WHERE owner_id=?", id),
    favorites: await rows("SELECT listing_id,created_at FROM favorites WHERE user_id=?", id),
    savedSearches: await rows("SELECT name,query,enabled,created_at FROM saved_searches WHERE user_id=?", id),
    messagesSent: await rows("SELECT id,listing_id,recipient_id,body,created_at FROM messages WHERE sender_id=? ORDER BY created_at", id),
    messagesReceived: await rows("SELECT id,listing_id,sender_id,body,created_at FROM messages WHERE recipient_id=? ORDER BY created_at", id),
    appointments: await rows("SELECT id,listing_id,slot_at,message,status,created_at FROM appointments WHERE buyer_id=?", id),
    emailPreferences: (await rows("SELECT messages,alerts,alerts_sent_at,updated_at FROM email_preferences WHERE user_id=?", id))[0] || null,
  };
}
