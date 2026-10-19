"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/SafeLink";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useLocale } from "@/lib/i18n";

type Mode = "login" | "register";
type Role = "buyer" | "individual" | "agent";

const googleErrors: Record<string, string> = {
  unavailable: "Google ile giriş henüz yapılandırılmadı.",
  cancelled: "Google ile giriş iptal edildi.",
  invalid: "Google giriş isteği doğrulanamadı. Yeniden deneyin.",
  expired: "Google giriş süresi doldu. Yeniden deneyin.",
  exchange: "Google hesabı doğrulanamadı. Yeniden deneyin.",
  identity: "Doğrulanmış bir Google e-posta adresi gerekli.",
  existing: "Bu e-posta zaten kayıtlı. Şifrenizle giriş yapıp profilinizden Google hesabını bağlayın.",
  link: "Google hesabı bağlantısı doğrulanamadı.",
  linked_elsewhere: "Bu Google hesabı başka bir üyeliğe bağlı.",
  failed: "Google ile giriş tamamlanamadı. Yeniden deneyin.",
};

function GoogleBlock({
  enabled,
  href,
  label,
  hint,
}: {
  enabled: boolean;
  href: string;
  label: string;
  hint?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="oauth-section oauth-first">
      {enabled ? (
        <a className="google-button" href={href}>
          <span className="google-symbol" aria-hidden="true">G</span>
          {label}
          <ArrowRight size={17} />
        </a>
      ) : (
        <button type="button" className="google-button" disabled>
          <span className="google-symbol" aria-hidden="true">G</span>
          {label}
        </button>
      )}
      {!enabled && <p>{t("Google ile giriş henüz yapılandırılmadı.")}</p>}
      {hint && enabled && <p>{hint}</p>}
    </div>
  );
}

export function AuthForm() {
  const { t } = useLocale();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("role") ? "register" : "login");
  const [role, setRole] = useState<Role>(params.get("role") === "agent" ? "agent" : "buyer");
  const [showPassword, setShowPassword] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(googleErrors[params.get("google") || ""] || "");

  useEffect(() => {
    fetch("/api/auth/google?status=1", { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => setGoogleEnabled(Boolean((value as { enabled?: boolean }).enabled)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const next = params.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/hesabim";
  const googleRole = mode === "register" ? role : "buyer";
  const googleUrl = `/api/auth/google?role=${googleRole}&next=${encodeURIComponent(safeNext)}`;
  const showBuyerGoogle = mode === "login" || role === "buyer";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      action: mode,
      email: form.get("email"),
      password: form.get("password"),
      name: form.get("name"),
      company: form.get("company"),
      companyCategory: form.get("companyCategory"),
      role,
    };
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error || "İşlem tamamlanamadı.");
        return;
      }
      window.location.assign(safeNext);
    } catch {
      setError("Bağlantı kurulamadı. Lütfen yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <img src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85" alt="Şık bir evin yaşam alanı" />
        <div className="auth-visual-copy">
          <span className="eyebrow light-eyebrow">ESTATEMARKET24</span>
          <h2>{t("Yeni yaşamınız,")}<br /><em>{t("burada başlar.")}</em></h2>
          <p>{t("Türkiye'nin en güzel adresleri tek bir yerde.")}</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-panel-inner">
          <span className="eyebrow dark-eyebrow">{t("HOŞ GELDİNİZ")}</span>
          <h1>{t(mode === "login" ? "Tekrar merhaba." : "Aramıza katılın.")}</h1>
          <p>
            {t(
              mode === "login"
                ? "Satılık ve kiralık ilanları keşfetmek, favorilere eklemek ve mesajlaşmak için giriş yapın."
                : "Yeni bir hesapla gayrimenkul yolculuğunuza başlayın. Bilgileriniz güvenli veritabanımızda saklanır.",
            )}
          </p>
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>
              {t("Giriş Yap")}
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>
              {t("Üye Ol")}
            </button>
          </div>

          {showBuyerGoogle && (
            <GoogleBlock
              enabled={googleEnabled}
              href={googleUrl}
              label={t(mode === "login" ? "Google ile Giriş Yap" : "Google ile Kayıt Ol")}
              hint={mode === "register" && role === "agent" ? t("Google ile kayıttan sonra ofis bilgilerinizi profilinizden tamamlayın.") : undefined}
            />
          )}

          {showBuyerGoogle && (
            <div className="oauth-divider oauth-between">
              <span>{t("veya e-posta ile devam edin")}</span>
            </div>
          )}

          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label>
                  {t("Ad Soyad")}
                  <input name="name" required minLength={2} placeholder={t("Adınız Soyadınız")} autoComplete="name" />
                </label>
                <label>
                  {t("Hesap türü")}
                  <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                    <option value="buyer">{t("İlan arıyorum")}</option>
                    <option value="individual">{t("Bireysel ilan vereceğim")}</option>
                    <option value="agent">{t("Emlakçıyım")}</option>
                  </select>
                </label>
                {role === "agent" && (
                  <>
                    <label>{t("Şirket türü")}<select name="companyCategory"><option value="agency">{t("Emlak ofisi")}</option><option value="developer">{t("İnşaat firması")}</option></select></label>
                    <label>
                      {t("Ofis / şirket adı")}
                      <input name="company" required minLength={2} placeholder={t("Emlak ofisi adı")} autoComplete="organization" />
                    </label>
                  </>
                )}
              </>
            )}
            <label>
              {t("E-posta")}
              <input name="email" required type="email" placeholder="ornek@eposta.com" autoComplete="email" />
            </label>
            <label>
              {t("Şifre")}
              <div className="password-input">
                <input
                  name="password"
                  required
                  minLength={10}
                  type={showPassword ? "text" : "password"}
                  placeholder={t("En az 10 karakter")}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={t(showPassword ? "Şifreyi gizle" : "Şifreyi göster")}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {mode === "register" && <p className="form-helper">{t("Emlakçı hesapları yönetici onayından sonra ilan verebilir.")}</p>}
            {error && <div className="form-error" role="alert">{t(error)}</div>}
            <button className="primary-button auth-submit" disabled={loading}>
              {t(loading ? "Lütfen bekleyin..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur")}
              <ArrowRight size={18} />
            </button>
          </form>

          {!showBuyerGoogle && (
            <GoogleBlock
              enabled={googleEnabled}
              href={googleUrl}
              label={t("Google ile devam et")}
              hint={t("Google ile kayıttan sonra ofis bilgilerinizi profilinizden tamamlayın.")}
            />
          )}

          <div className="auth-footnote">
            <LockKeyhole size={15} />
            {t("Üyelik, favoriler, mesajlar ve ilan fotoğrafları tek veritabanında güvenle saklanır.")}
          </div>
          <Link href="/" className="back-link">← {t("Ana sayfaya dön")}</Link>
        </div>
      </div>
    </main>
  );
}
