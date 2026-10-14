"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowUpRight, Mail, RefreshCw, Send } from "lucide-react";
import { useLocale } from "@/lib/i18n";

export type Conversation = {
  id: string;
  listing_id: string;
  peer_id: string;
  peer_name: string;
  listing_title: string;
  listing_status: string | null;
  sender_id: string;
  last_body: string;
  last_at: string;
};

type ThreadMessage = {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

const threadKey = (conversation: Conversation) => `${conversation.listing_id}:${conversation.peer_id}`;

export function MessagesInbox({ userId, initialConversations }: { userId: string; initialConversations: Conversation[] }) {
  const { t, locale } = useLocale();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedKey, setSelectedKey] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("listingId") && params.get("peerId") ? `${params.get("listingId")}:${params.get("peerId")}` : "";
  });
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const selected = conversations.find((item) => threadKey(item) === selectedKey) || conversations[0];

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      if (!response.ok) throw new Error("Görüşmeler yüklenemedi.");
      const data = await response.json() as { conversations?: Conversation[] };
      setConversations(data.conversations || []);
    } catch {
      setError("Görüşmeler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    const timer = window.setInterval(refreshConversations, 20000);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    async function refreshThread(first = false) {
      if (first) setLoadingThread(true);
      try {
        const response = await fetch(`/api/messages?listingId=${encodeURIComponent(selected.listing_id)}&peerId=${encodeURIComponent(selected.peer_id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Mesajlar yüklenemedi.");
        const data = await response.json() as { messages?: ThreadMessage[] };
        if (active) { setThread(data.messages || []); setError(""); }
      } catch {
        if (active) setError("Mesajlar yüklenemedi.");
      } finally {
        if (active && first) setLoadingThread(false);
      }
    }
    refreshThread(true);
    const timer = window.setInterval(() => refreshThread(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected?.listing_id, selected?.peer_id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread.length, selectedKey]);

  function choose(conversation: Conversation) {
    setSelectedKey(threadKey(conversation));
    setThread([]);
    setError("");
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "mesajlar");
    params.set("listingId", conversation.listing_id);
    params.set("peerId", conversation.peer_id);
    window.history.replaceState(null, "", `/hesabim?${params.toString()}`);
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending || draft.trim().length < 2) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: selected.listing_id, peerId: selected.peer_id, message: draft.trim() }),
      });
      const data = await response.json() as { error?: string; id?: string; createdAt?: string };
      if (!response.ok) throw new Error(data.error || "Mesaj gönderilemedi.");
      setThread((items) => [...items, {
        id: data.id || crypto.randomUUID(), listing_id: selected.listing_id, sender_id: userId,
        recipient_id: selected.peer_id, body: draft.trim(), created_at: data.createdAt || new Date().toISOString(),
      }]);
      setDraft("");
      refreshConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  if (conversations.length === 0) return <div className="panel-empty"><Mail size={28}/><h3>{t("Henüz mesajınız yok.")}</h3><p>{t("Gerçek ilanlarda ilan sahibine mesaj gönderdiğinizde görüşmeniz burada görünür.")}</p><Link href="/ilanlar">{t("İlanlara göz atın")} →</Link></div>;

  return <div className="inbox" aria-label={t("Mesaj kutusu")}>
    <div className="inbox-conversations">
      <div className="inbox-list-head"><strong>{t("Görüşmeler")}</strong><button type="button" onClick={refreshConversations} aria-label={t("Görüşmeleri yenile")}><RefreshCw size={16}/></button></div>
      {conversations.map((conversation) => <button type="button" key={threadKey(conversation)} className={`inbox-conversation ${selected && threadKey(selected) === threadKey(conversation) ? "active" : ""}`} onClick={() => choose(conversation)}>
        <span className="inbox-avatar" aria-hidden="true">{conversation.peer_name.charAt(0).toLocaleUpperCase(locale)}</span>
        <span className="inbox-conversation-copy"><strong>{conversation.peer_name}</strong><small>{conversation.listing_title}</small><span>{conversation.last_body}</span></span>
        <time dateTime={conversation.last_at}>{new Date(conversation.last_at).toLocaleDateString(locale)}</time>
      </button>)}
    </div>
    {selected && <div className="inbox-thread">
      <div className="inbox-thread-head"><div><span className="eyebrow dark-eyebrow">{t("İLAN GÖRÜŞMESİ")}</span><h3>{selected.peer_name}</h3><p>{selected.listing_title}</p></div>{selected.listing_status === "published" && <Link href={`/ilan/${selected.listing_id}`} title={t("İlanı görüntüle")}><ArrowUpRight size={19}/></Link>}</div>
      <div className="inbox-thread-messages" aria-live="polite">
        {loadingThread ? <p className="inbox-muted">{t("Mesajlar yükleniyor...")}</p> : thread.length === 0 ? <p className="inbox-muted">{t("Bu görüşmede henüz mesaj yok.")}</p> : thread.map((message) => <div key={message.id} className={`inbox-bubble ${message.sender_id === userId ? "mine" : "theirs"}`}><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></div>)}
        <div ref={bottomRef}/>
      </div>
      {selected.listing_status ? <form className="inbox-compose" onSubmit={send}><label htmlFor="inbox-draft" className="sr-only">{t("Yanıtınız")}</label><textarea id="inbox-draft" value={draft} onChange={(event) => setDraft(event.target.value)} minLength={2} maxLength={2000} rows={2} placeholder={t("Mesajınızı yazın...")} required/><button type="submit" disabled={sending || draft.trim().length < 2} aria-label={t("Mesaj gönder")}><Send size={18}/><span>{t(sending ? "Gönderiliyor..." : "Gönder")}</span></button></form> : <p className="inbox-muted">{t("Bu ilan artık yayında değil.")}</p>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
    </div>}
  </div>;
}
