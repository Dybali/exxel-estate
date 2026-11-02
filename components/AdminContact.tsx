"use client";
import {useCallback, useEffect, useState} from "react";
import {Check, Mail, RotateCcw} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {CONTACT_SUBJECTS, type ContactMessage} from "@/lib/contact";

type Filter = "new" | "handled" | "all";

// Admin view "İletişim mesajları": messages from the public contact form, newest first.
export function AdminContact() {
  const {t, locale} = useLocale();
  const [filter, setFilter] = useState<Filter>("new"), [messages, setMessages] = useState<ContactMessage[] | null>(null), [newCount, setNewCount] = useState(0);
  const [error, setError] = useState(""), [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/contact?status=${filter}`, {cache: "no-store"});
      const data = await apiJson<{messages?: ContactMessage[]; newCount?: number; error?: string}>(response);
      if (!response.ok || !data.messages) throw new Error(data.error || "Mesajlar yüklenemedi.");
      setMessages(data.messages); setNewCount(data.newCount || 0); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  async function mark(id: string, handled: boolean) {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/admin/contact", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id, handled})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
  return <section className="admin-contact">
    <div className="admin-filterbar"><div className="admin-tabs">{([["new", "Yanıt bekleyen"], ["handled", "Yanıtlandı"], ["all", "Tümü"]] as const).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{t(label)}{id === "new" ? ` · ${newCount}` : ""}</button>)}</div></div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {!messages && !error && <div className="admin-card admin-loading">{t("Mesajlar yükleniyor…")}</div>}
    {messages && !messages.length && <div className="admin-card admin-empty"><Mail size={28}/><strong>{t("Bu filtrede mesaj yok.")}</strong></div>}
    {messages?.map((message) => <article key={message.id} className={`admin-card admin-contact-item${message.status === "handled" ? " is-handled" : ""}`}>
      <header><div><strong>{message.name}</strong> <a href={`mailto:${message.email}`}>{message.email}</a></div><span className={`admin-badge ${message.status === "handled" ? "good" : "pending"}`}>{t(message.status === "handled" ? "Yanıtlandı" : "Yanıt bekliyor")}</span></header>
      <p className="admin-muted">{t(CONTACT_SUBJECTS[message.subject])} · {date(message.createdAt)} · {message.locale.toUpperCase()}{message.userId ? ` · ${t("Üye")}` : ""}</p>
      <p className="admin-contact-text">{message.message}</p>
      <div className="admin-contact-actions">
        <a className="admin-secondary" href={`mailto:${message.email}?subject=${encodeURIComponent("estatemarket24: " + t(CONTACT_SUBJECTS[message.subject]))}`}><Mail size={15}/>{t("E-postayla yanıtla")}</a>
        {message.status === "new"
          ? <button type="button" className="admin-primary" disabled={busy === message.id} onClick={() => void mark(message.id, true)}><Check size={15}/>{t("Yanıtlandı olarak işaretle")}</button>
          : <button type="button" className="admin-secondary" disabled={busy === message.id} onClick={() => void mark(message.id, false)}><RotateCcw size={15}/>{t("Yeniden aç")}</button>}
      </div>
    </article>)}
  </section>;
}
