"use client";
import { useState } from "react";
import Link from "@/components/SafeLink";
import { Languages, Send } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { firmThreadKey, type FirmKind } from "@/lib/firm-plans";

// "Mesaj gönder" on a firm profile and on the offers a member received; the message goes to the firm's Hesabım ›
// Mesajlar. With peerId the firm writes to a member whose request reached it (firm inbox, 2026-11-25). Both sides
// read the other's messages machine-translated into their own language. The package check is on the server.
export function FirmMessage({ kind, firmId, peerId, label = "Mesaj gönder", compact = false }: { kind: FirmKind; firmId: string; peerId?: string; label?: string; compact?: boolean }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [sent, setSent] = useState<string | null>(null), [signIn, setSignIn] = useState(false);
  const key = firmThreadKey(kind, firmId);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: key, ...(peerId ? { peerId } : {}), message: draft.trim(), requestId: crypto.randomUUID() }) });
      const data = await apiJson<{ error?: string; peerId?: string }>(response);
      if (response.status === 401) { setSignIn(true); return; }
      if (!response.ok || !data.peerId) throw new Error(data.error || "Mesaj gönderilemedi.");
      setSent(`/hesabim?tab=mesajlar&listingId=${encodeURIComponent(key)}&peerId=${encodeURIComponent(data.peerId)}`); setDraft("");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  const next = typeof window === "undefined" ? "/" : window.location.pathname;
  if (sent) return <p className="profile-save-success firm-message-sent" role="status">{t(peerId ? "Mesajınız müşteriye iletildi." : "Mesajınız firmaya iletildi.")} <Link href={sent}>{t("Mesajlara git")}</Link></p>;
  if (!open) return <button type="button" className={compact ? "outline-button" : "btn btn-secondary btn-block"} onClick={() => setOpen(true)}><Send size={compact ? 15 : 17} aria-hidden="true"/>{t(label)}</button>;
  return <form className="firm-message" onSubmit={send}>
    <label htmlFor={`firm-message-${firmId}`}>{t("Mesajınız")}</label>
    <textarea id={`firm-message-${firmId}`} rows={4} minLength={2} maxLength={2000} required value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} placeholder={t(peerId ? "Merhaba, talebinizle ilgili bir sorum var." : "Merhaba, firmanızı estatemarket24'te gördüm.")}/>
    <p className="firm-message-note"><Languages size={14} aria-hidden="true"/>{t(peerId ? "Kendi dilinizde yazın: müşteri mesajı kendi dilinde okur, cevabını da siz kendi dilinizde görürsünüz." : "Kendi dilinizde yazın: firma mesajı kendi dilinde okur, cevabını da siz kendi dilinizde görürsünüz.")}</p>
    {signIn && <p className="form-error" role="alert">{t("Mesaj göndermek için giriş yapın.")} <Link href={`/giris?next=${encodeURIComponent(next)}`}>{t("Giriş yap")}</Link></p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="firm-message-actions"><button type="submit" className="btn btn-primary btn-block" disabled={busy || draft.trim().length < 2}><Send size={17} aria-hidden="true"/>{t(busy ? "Gönderiliyor…" : "Gönder")}</button>{compact && <button type="button" className="outline-button" onClick={() => setOpen(false)}>{t("Vazgeç")}</button>}</div>
  </form>;
}
