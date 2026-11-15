import { db } from "@/lib/server";
import { unsubscribe, type NotificationDatabase } from "@/lib/email-notifications";

const page = (ok: boolean) => new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>estatemarket24</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#17334b"><h1 style="font-size:20px">${ok ? "Abonelikten çıktınız" : "Bağlantı geçersiz"}</h1><p>${ok ? "Bu tür e-postalar artık gönderilmeyecek. Tercihlerinizi Hesabım → Aramalarım ve bildirimler bölümünden değiştirebilirsiniz." : "Bağlantının süresi dolmuş veya hatalı olabilir."}</p><p lang="en" style="color:#5d6b62">${ok ? "You have been unsubscribed. You can change this in your account settings." : "This link is invalid."}</p><p><a href="/">estatemarket24</a></p></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

async function handle(request: Request) {
  const q = new URL(request.url).searchParams;
  return page(await unsubscribe(db() as unknown as NotificationDatabase, q.get("token") || "", q.get("type") || "all"));
}

// Link scanners in mail systems (e.g. Outlook Safe Links) open every link with GET, so GET only shows a
// confirmation button; the unsubscribe itself is a POST, from that button or from mail clients'
// one-click unsubscribe (RFC 8058).
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const action = `/api/email/unsubscribe?token=${encodeURIComponent(q.get("token") || "")}&type=${encodeURIComponent(q.get("type") || "all")}`;
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>estatemarket24</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#15171c"><h1 style="font-size:22px">E-posta bildirimleri</h1><p>Bu e-posta bildirimlerini artık almak istemiyor musunuz?</p><p style="color:#56635f">Do you want to stop receiving these email notifications?</p><form method="post" action="${escapeHtml(action)}"><button type="submit" style="background:#0b5f63;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer">Aboneliği iptal et / Unsubscribe</button></form></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
export const POST = handle;
