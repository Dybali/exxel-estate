"use client";

import { useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function AdminSetup() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Kurulum tamamlanamadı.");
      window.location.assign("/yonetim");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kurulum tamamlanamadı.");
      setBusy(false);
    }
  }

  return <main className="admin-page"><div className="form-hero"><div className="container"><span className="eyebrow dark-eyebrow">SALESORRENT · YÖNETİM</span><h1>Yönetici <em>kurulumu.</em></h1><p>İlan onaylarını yönetmek için tek kullanımlık kurulum kodunu girin.</p></div></div><div className="container admin-setup-wrap"><div className="admin-setup-card"><ShieldCheck size={31}/><h2>Yönetici hesabını açın</h2><p>Bu işlem önceden belirlenen yönetici e-postasına erişim verir. O e-postayla daha önce hesap açıldıysa şifresi yenilenir ve eski oturumlar kapatılır.</p><form onSubmit={submit}><label>Kurulum kodu<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required/></label><label>Ad soyad<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" required/></label><label>Yeni şifre<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>Yönetici hesabını etkinleştir <ArrowRight size={17}/></button></form><Link href="/" className="back-link">Ana sayfaya dön</Link></div></div></main>;
}
