"use client";
import {useEffect, useState} from "react";
import {MailCheck} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";

// "Hizmet durumu" card: which provider sends the site's e-mail, and a test e-mail to the signed-in
// administrator to check the SMTP (Mittwald mailbox) or Resend settings (docs/email-notifications.md).
export function AdminEmailTest() {
  const {t} = useLocale();
  const [status, setStatus] = useState<{provider: string | null; to: string} | null>(null);
  const [busy, setBusy] = useState(false), [result, setResult] = useState<{ok: boolean; text: string; to?: string} | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/email-test", {cache: "no-store"});
        const data = await apiJson<{provider?: string | null; to?: string; error?: string}>(response);
        if (!response.ok) throw new Error(data.error || "E-posta durumu alınamadı.");
        setStatus({provider: data.provider || null, to: data.to || ""});
      } catch (cause) { setResult({ok: false, text: (cause as Error).message}); }
    })();
  }, []);
  async function send() {
    setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/admin/email-test", {method: "POST"});
      const data = await apiJson<{sent?: boolean; to?: string; error?: string}>(response);
      if (response.ok && data.sent) setResult({ok: true, text: "Test e-postası gönderildi:", to: data.to});
      else setResult({ok: false, text: data.error || "Test e-postası gönderilemedi. Sunucu günlüğünde [email] satırlarına bakın."});
    } catch (cause) { setResult({ok: false, text: (cause as Error).message}); } finally { setBusy(false); }
  }
  const label = status?.provider === "smtp" ? "Gönderim: SMTP (Mittwald posta kutusu)" : status?.provider === "resend" ? "Gönderim: Resend" : "E-posta gönderimi yapılandırılmamış.";
  return <article className="admin-service">
    <h3>{t("Site e-postası")}</h3>
    <strong>{status ? t(label) : "…"}</strong>
    <p>{t(status?.provider ? "Test e-postası oturum açmış yöneticinin adresine gider." : "SMTP_HOST, SMTP_USER, SMTP_PASSWORD ve EMAIL_FROM ayarlarını girin (docs/email-notifications.md).")}{status?.provider && status.to ? ` (${status.to})` : ""}</p>
    <p><button type="button" className="btn btn-secondary btn-sm" disabled={busy || !status?.provider} onClick={() => void send()}><MailCheck size={15}/>{t(busy ? "Gönderiliyor…" : "Test e-postası gönder")}</button></p>
    {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "" : "form-error"}>{t(result.text)}{result.to ? ` ${result.to}` : ""}</p>}
  </article>;
}
