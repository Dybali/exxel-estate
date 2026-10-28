import { db } from "@/lib/server";
import { unsubscribe, type NotificationDatabase } from "@/lib/email-notifications";

const page = (ok: boolean) => new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>estatemarket24</title></head><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 16px;color:#17334b"><h1 style="font-size:20px">${ok ? "Abonelikten çıktınız" : "Bağlantı geçersiz"}</h1><p>${ok ? "Bu tür e-postalar artık gönderilmeyecek. Tercihlerinizi Hesabım → Aramalarım ve bildirimler bölümünden değiştirebilirsiniz." : "Bağlantının süresi dolmuş veya hatalı olabilir."}</p><p lang="en" style="color:#5d6b62">${ok ? "You have been unsubscribed. You can change this in your account settings." : "This link is invalid."}</p><p><a href="/">estatemarket24</a></p></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

async function handle(request: Request) {
  const q = new URL(request.url).searchParams;
  return page(await unsubscribe(db() as unknown as NotificationDatabase, q.get("token") || "", q.get("type") || "all"));
}

// GET from the link in the email; POST from mail clients' one-click unsubscribe (RFC 8058).
export const GET = handle;
export const POST = handle;
