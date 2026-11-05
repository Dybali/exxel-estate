"use client";
import {useCallback, useEffect, useState} from "react";
import {Check, Mail, Reply, RotateCcw, Send} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {CONTACT_LIMITS, CONTACT_SUBJECTS, type ContactMessage} from "@/lib/contact";

type Filter = "new" | "handled" | "all";

// Admin view "İletişim mesajları": messages from the public contact form, newest first. A message can be
// answered inline (sent by e-mail through /api/admin/contact/reply) or with the mailto link as fallback.
export function AdminContact() {
  const {t, locale} = useLocale();
  const [filter, setFilter] = useState<Filter>("new"), [messages, setMessages] = useState<ContactMessage[] | null>(null), [newCount, setNewCount] = useState(0);
  const [error, setError] = useState(""), [busy, setBusy] = useState(""), [notice, setNotice] = useState("");
  const [emailProvider, setEmailProvider] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState(""), [replyText, setReplyText] = useState(""), [replyError, setReplyError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/contact?status=${filter}`, {cache: "no-store"});
      const data = await apiJson<{messages?: ContactMessage[]; newCount?: number; emailProvider?: string | null; error?: string}>(response);
      if (!response.ok || !data.messages) throw new Error(data.error || "Mesajlar yüklenemedi.");
      setMessages(data.messages); setNewCount(data.newCount || 0); setEmailProvider(data.emailProvider || null); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  async function mark(id: string, handled: boolean) {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/contact", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id, handled})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); }
  }
  function openReply(id: string) { setReplyFor(id); setReplyText(""); setReplyError(""); setNotice(""); }
  async function sendReply(id: string) {
    setBusy(id); setReplyError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/contact/reply", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id, text: replyText})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "Yanıt gönderilemedi. E-posta ayarlarını kontrol edin veya e-posta programınızdan yanıtlayın.");
      setReplyFor(""); setReplyText(""); setNotice("Yanıt gönderildi ve mesaj yanıtlandı olarak işaretlendi.");
      await load();
    } catch (cause) { setReplyError((cause as Error).message); } finally { setBusy(""); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
  return <section className="admin-contact">
    <div className="admin-filterbar"><div className="admin-tabs">{([["new", "Yanıt bekleyen"], ["handled", "Yanıtlandı"], ["all", "Tümü"]] as const).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{t(label)}{id === "new" ? ` · ${newCount}` : ""}</button>)}</div></div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {notice && <div className="admin-notice success" role="status">{t(notice)}</div>}
    {messages && !emailProvider && <div className="admin-notice">{t("E-posta gönderimi yapılandırılmamış. Yanıtı e-posta programınızdan gönderin.")}</div>}
    {!messages && !error && <div className="admin-card admin-loading">{t("Mesajlar yükleniyor…")}</div>}
    {messages && !messages.length && <div className="admin-card admin-empty"><Mail size={28}/><strong>{t("Bu filtrede mesaj yok.")}</strong></div>}
    {messages?.map((message) => <article key={message.id} className={`admin-card admin-contact-item${message.status === "handled" ? " is-handled" : ""}`}>
      <header><div><strong>{message.name}</strong> <a href={`mailto:${message.email}`}>{message.email}</a></div><span className={`admin-badge ${message.status === "handled" ? "good" : "pending"}`}>{t(message.status === "handled" ? "Yanıtlandı" : "Yanıt bekliyor")}</span></header>
      <p className="admin-muted">{t(CONTACT_SUBJECTS[message.subject])} · {date(message.createdAt)} · {message.locale.toUpperCase()}{message.userId ? ` · ${t("Üye")}` : ""}</p>
      <p className="admin-contact-text">{message.message}</p>
      {!!message.replies?.length && <div className="admin-contact-replies">
        <strong>{t("Gönderilen yanıtlar")}</strong>
        {message.replies.map((reply) => <div key={reply.id} className="admin-contact-reply"><p className="admin-muted">{date(reply.createdAt)}{reply.adminName ? ` · ${reply.adminName}` : ""}</p><p className="admin-contact-text">{reply.body}</p></div>)}
      </div>}
      <div className="admin-contact-actions">
        {replyFor !== message.id && <button type="button" className="btn btn-primary btn-sm" disabled={!emailProvider || busy === message.id} onClick={() => openReply(message.id)}><Reply size={15}/>{t("Yanıtla")}</button>}
        <a className="admin-secondary" href={`mailto:${message.email}?subject=${encodeURIComponent("estatemarket24: " + t(CONTACT_SUBJECTS[message.subject]))}`}><Mail size={15}/>{t("E-postayla yanıtla")}</a>
        {message.status === "new"
          ? <button type="button" className="admin-primary" disabled={busy === message.id} onClick={() => void mark(message.id, true)}><Check size={15}/>{t("Yanıtlandı olarak işaretle")}</button>
          : <button type="button" className="admin-secondary" disabled={busy === message.id} onClick={() => void mark(message.id, false)}><RotateCcw size={15}/>{t("Yeniden aç")}</button>}
      </div>
      {replyFor === message.id && <form className="admin-contact-reply-form" onSubmit={(event) => { event.preventDefault(); void sendReply(message.id); }}>
        <label htmlFor={`reply-${message.id}`}>{t("Yanıtınız")}</label>
        <textarea id={`reply-${message.id}`} rows={6} maxLength={CONTACT_LIMITS.replyMax} value={replyText} onChange={(event) => setReplyText(event.target.value)} autoFocus/>
        <p className="admin-muted">{t("Yanıt e-postayla gönderilir, orijinal mesaj altına eklenir. Ziyaretçinin cevabı iletişim adresine gelir.")}</p>
        {replyError && <div className="admin-notice error" role="alert">{t(replyError)}</div>}
        <div className="admin-contact-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy === message.id || replyText.trim().length < CONTACT_LIMITS.replyMin}><Send size={15}/>{t(busy === message.id ? "Gönderiliyor…" : "Yanıtı gönder")}</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy === message.id} onClick={() => setReplyFor("")}>{t("Vazgeç")}</button>
        </div>
      </form>}
    </article>)}
  </section>;
}
