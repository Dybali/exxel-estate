import { env } from "@/lib/runtime";
import { body, clientIp, createSession, db, error, now, ok, passwordHash, sameOrigin, sessionCookie, sha256, str } from "@/lib/server";

type SetupEnv = Cloudflare.Env & { EXXEL_ADMIN_EMAIL?: string; EXXEL_ADMIN_SETUP_CODE?: string };

function equalsSecret(received: string, expected: string) {
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const settings = env as SetupEnv;
  const email = settings.EXXEL_ADMIN_EMAIL?.trim().toLowerCase();
  const expectedCode = settings.EXXEL_ADMIN_SETUP_CODE?.trim();
  if (!email || !expectedCode) return error("Yönetici kurulumu henüz hazır değil.", 503);
  const completed = await db().prepare("SELECT id FROM admin_setup WHERE id='primary'").first();
  if (completed) return error("Yönetici kurulumu tamamlandı.", 409);

  const ip = clientIp(request);
  const limitKey = await sha256(`admin-setup:${ip}`);
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const attempts = await db().prepare("SELECT failures,window_started_at FROM auth_limits WHERE key=?")
    .bind(limitKey).first<{ failures: number; window_started_at: string }>();
  if (attempts && attempts.window_started_at > cutoff && attempts.failures >= 5) return error("Çok fazla deneme. 15 dakika sonra tekrar deneyin.", 429);

  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const code = str(data.code, 256), name = str(data.name, 100);
  const password = typeof data.password === "string" ? data.password : "";
  if (!equalsSecret(code, expectedCode)) {
    const started = attempts && attempts.window_started_at > cutoff ? attempts.window_started_at : now();
    const failures = attempts && attempts.window_started_at > cutoff ? attempts.failures + 1 : 1;
    await db().prepare("INSERT INTO auth_limits(key,failures,window_started_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at")
      .bind(limitKey, failures, started).run();
    return error("Kurulum kodu geçersiz.", 403);
  }
  if (name.length < 2 || password.length < 12 || password.length > 128) return error("Ad ve en az 12 karakterli şifre girin.");

  const existing = await db().prepare("SELECT id FROM users WHERE email=?").bind(email).first<{ id: string }>();
  const userId = existing?.id || crypto.randomUUID();
  const hash = await passwordHash(password);
  const completedAt = now();
  try {
    if (existing) {
      await db().batch([
        db().prepare("UPDATE users SET name=?,password_hash=?,role='admin',agent_status='none' WHERE id=?").bind(name, hash, userId),
        db().prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
        db().prepare("INSERT INTO admin_setup(id,user_id,completed_at) VALUES('primary',?,?)").bind(userId, completedAt),
      ]);
    } else {
      await db().batch([
        db().prepare("INSERT INTO users(id,email,password_hash,email_verified,name,role,agent_status,company,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(userId, email, hash, 0, name, "admin", "none", null, completedAt),
        db().prepare("INSERT INTO admin_setup(id,user_id,completed_at) VALUES('primary',?,?)").bind(userId, completedAt),
      ]);
    }
  } catch {
    return error("Kurulum tamamlanamadı; yeniden deneyin.", 409);
  }
  await db().prepare("DELETE FROM auth_limits WHERE key=?").bind(limitKey).run();
  const token = await createSession(userId);
  return ok({ success: true }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
}
