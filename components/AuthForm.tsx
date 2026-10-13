"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";

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

export function AuthForm() {
  const router = useRouter();
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
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/hesabim";
  const googleUrl = `/api/auth/google?role=${mode === "register" ? role : "buyer"}&next=${encodeURIComponent(safeNext)}`;

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
      router.push(safeNext);
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. Lütfen yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-visual">
      <img src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85" alt="Şık bir evin yaşam alanı" />
      <div className="auth-visual-copy"><span className="eyebrow light-eyebrow">EXXEL ESTATE</span><h2>Yeni yaşamınız,<br /><em>burada başlar.</em></h2><p>Türkiye&apos;nin en güzel adresleri tek bir yerde.</p></div>
    </div>
    <div className="auth-panel"><div className="auth-panel-inner">
      <span className="eyebrow dark-eyebrow">HOŞ GELDİNİZ</span>
      <h1>{mode === "login" ? "Tekrar merhaba." : "Aramıza katılın."}</h1>
      <p>{mode === "login" ? "Hesabınıza giriş yaparak favorilerinizi ve mesajlarınızı yönetin." : "Yeni bir hesapla gayrimenkul yolculuğunuza başlayın."}</p>
      <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Giriş Yap</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Üye Ol</button></div>
      <form onSubmit={submit}>
        {mode === "register" && <>
          <label>Ad Soyad<input name="name" required minLength={2} placeholder="Adınız Soyadınız" autoComplete="name" /></label>
          <label>Hesap türü<select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="buyer">İlan arıyorum</option><option value="individual">Bireysel ilan vereceğim</option><option value="agent">Emlakçıyım</option></select></label>
          {role === "agent" && <label>Ofis / şirket adı<input name="company" required minLength={2} placeholder="Emlak ofisi adı" autoComplete="organization" /></label>}
        </>}
        <label>E-posta<input name="email" required type="email" placeholder="ornek@eposta.com" autoComplete="email" /></label>
        <label>Şifre<div className="password-input"><input name="password" required minLength={10} type={showPassword ? "text" : "password"} placeholder="En az 10 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        {mode === "register" && <p className="form-helper">Emlakçı hesapları yönetici onayından sonra ilan verebilir.</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button auth-submit" disabled={loading}>{loading ? "Lütfen bekleyin..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}<ArrowRight size={18} /></button>
      </form>
      {googleEnabled && <div className="oauth-section"><div className="oauth-divider"><span>veya</span></div><a className="google-button" href={googleUrl}><span className="google-symbol" aria-hidden="true">G</span> Google ile devam et <ArrowRight size={17} /></a>{mode === "register" && role === "agent" && <p>Google ile kayıttan sonra ofis bilgilerinizi profilinizden tamamlayın.</p>}</div>}
      <div className="auth-footnote"><LockKeyhole size={15} /> Bilgileriniz güvenli bir oturumda korunur.</div>
      <Link href="/" className="back-link">← Ana sayfaya dön</Link>
    </div></div>
  </main>;
}
