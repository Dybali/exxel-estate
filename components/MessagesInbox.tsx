"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowUpRight, Check, CheckCheck, ChevronLeft, Mail, MessageCircle, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";
import { whatsappHref } from "@/lib/phone";
import { useLocale } from "@/lib/i18n";
export type Conversation = { id: string; listing_id: string; peer_id: string; peer_name: string; peer_role?: string; peer_company?: string; peer_whatsapp_phone?:string|null; listing_title: string; listing_status: string | null; sender_id: string; last_body: string; last_at: string; unread_count?: number };
export type MessageRecipient = { id: string; name: string; role?: string; company?: string; context?: string };
type ThreadMessage = { id: string; listing_id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at?: string | null };
const keyOf = (c: Conversation) => `${c.listing_id}:${c.peer_id}`;
const merge = (old: ThreadMessage[], next: ThreadMessage[]) => [...new Map([...old, ...next].map(m => [m.id, m])).values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
async function jsonResponse(response: Response) {
  const data = await response.json() as { error?: string; message?: string; conversations?: Conversation[]; messages?: ThreadMessage[]; hasMore?: boolean; unreadTotal?: number; id?: string; createdAt?: string };
  if (!response.ok) throw new Error(data.error || data.message || "İşlem tamamlanamadı. Yeniden deneyin.");
  return data;
}
export function MessagesInbox({ userId, initialConversations, adminMode = false, newRecipient, onUnreadChange }: { userId: string; initialConversations: Conversation[]; adminMode?: boolean; newRecipient?: MessageRecipient | null; onUnreadChange?: (count: number) => void }) {
  const { t, locale } = useLocale();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedKey, setSelectedKey] = useState(() => { if (typeof window === "undefined") return ""; const p = new URLSearchParams(window.location.search); return p.get("listingId") && p.get("peerId") ? `${p.get("listingId")}:${p.get("peerId")}` : ""; });
  const [thread, setThread] = useState<ThreadMessage[]>([]), [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false), [sending, setSending] = useState(false), [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState(""), [listError, setListError] = useState(""), [hasOlder, setHasOlder] = useState(false), [hasMore, setHasMore] = useState(false), [page, setPage] = useState(1);
  const [search, setSearch] = useState(""), [unreadOnly, setUnreadOnly] = useState(false), [refresh, setRefresh] = useState(0);
  const drafts = useRef(new Map<string,string>()), retries = useRef(new Map<string,{ body: string; id: string }>());
  const loadedPage = useRef(1);
  const selectedRef = useRef(selectedKey), bottom = useRef<HTMLDivElement>(null), pane = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null);
  selectedRef.current = selectedKey;
  const provisional: Conversation | null = newRecipient ? { id: `new-${newRecipient.id}`, listing_id: `admin:${userId}:${newRecipient.id}`, peer_id: newRecipient.id, peer_name: newRecipient.name, peer_role: newRecipient.role, peer_company: newRecipient.company, listing_title: "estatemarket24 · Destek", listing_status: "support", sender_id: userId, last_body: "Yeni görüşme", last_at: "", unread_count: 0 } : null;
  const all = provisional && !conversations.some(c => keyOf(c) === keyOf(provisional)) ? [provisional, ...conversations] : conversations;
  const selected = all.find(c => keyOf(c) === selectedKey);
  const support = selected?.listing_id.startsWith("admin:");
  const callbackRef = useRef(onUnreadChange); callbackRef.current = onUnreadChange;
  const refreshConversations = useCallback(async (nextPage = 1) => {
    try {
      const data = await jsonResponse(await fetch(`/api/messages?page=${nextPage}`, { cache: "no-store" }));
      setConversations(old => [...new Map([...old, ...(data.conversations || [])].map(c => [keyOf(c), c])).values()].sort((a,b) => b.last_at.localeCompare(a.last_at) || b.id.localeCompare(a.id)));
      if (nextPage >= loadedPage.current) { loadedPage.current = nextPage; setPage(nextPage); setHasMore(!!data.hasMore); } setListError(""); callbackRef.current?.(Number(data.unreadTotal || 0));
    } catch (cause) { setListError(cause instanceof Error ? cause.message : "Görüşmeler yüklenemedi."); }
  }, []);
  useEffect(() => { refreshConversations(); const timer = setInterval(() => { if (!document.hidden) refreshConversations(); }, 20000); return () => clearInterval(timer); }, [refreshConversations]);
  useEffect(() => { if (!newRecipient) return; drafts.current.set(selectedRef.current, draft); const key = `admin:${userId}:${newRecipient.id}:${newRecipient.id}`; setSelectedKey(key); setDraft(drafts.current.get(key) || (newRecipient.context ? `Merhaba, “${newRecipient.context}” başlıklı ilanınız hakkında sizinle iletişime geçiyoruz.\n\n` : "")); setThread([]); setError(""); }, [newRecipient, userId]);
  useEffect(() => {
    setThread([]); setHasOlder(false); setError("");
    if (!selected) return;
    const control = new AbortController(); const key = keyOf(selected);
    async function load(first = false) {
      if (first) setLoading(true);
      try {
        const data = await jsonResponse(await fetch(`/api/messages?listingId=${encodeURIComponent(selected!.listing_id)}&peerId=${selected!.peer_id}`, { cache: "no-store", signal: control.signal }));
        if (!control.signal.aborted && selectedRef.current === key) { setThread(old => first ? data.messages || [] : merge(old, data.messages || [])); if (first) setHasOlder(!!data.hasMore); setError(""); }
      } catch (cause) { if (!control.signal.aborted) setError(cause instanceof Error ? cause.message : "Mesajlar yüklenemedi."); }
      finally { if (!control.signal.aborted && first) setLoading(false); }
    }
    load(true); const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { control.abort(); clearInterval(timer); };
  }, [selected?.listing_id, selected?.peer_id, refresh]);
  useEffect(() => { if (!olderBusy) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [thread.at(-1)?.id]);
  useEffect(() => {
    const box = pane.current; if (!box || !selected || !thread.length) return;
    const pending = thread.filter(m => m.recipient_id === userId && !m.read_at);
    if (!pending.length) return;
    let busy = false, alive = true;
    const mark = async () => {
      const rect = box.getBoundingClientRect();
      if (busy || document.hidden || !document.hasFocus() || rect.bottom <= 0 || rect.top >= innerHeight) return;
      busy = true;
      try {
        await jsonResponse(await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", listingId: selected.listing_id, peerId: selected.peer_id, ids: pending.map(m => m.id) }) }));
        if (alive && selectedRef.current === keyOf(selected)) { const ids = new Set(pending.map(m=>m.id)); setThread(old => old.map(m => ids.has(m.id) ? { ...m, read_at: new Date().toISOString() } : m)); setConversations(old => old.map(c => keyOf(c) === keyOf(selected) ? { ...c, unread_count: Math.max(0, Number(c.unread_count || 0) - pending.length) } : c)); refreshConversations(); window.dispatchEvent(new Event("messages:changed")); }
      } catch { busy = false; }
    };
    const observer = new IntersectionObserver(() => mark(), {threshold: 0.1}); observer.observe(box);
    window.addEventListener("focus", mark); document.addEventListener("visibilitychange", mark); mark();
    return () => { alive = false; observer.disconnect(); window.removeEventListener("focus", mark); document.removeEventListener("visibilitychange", mark); };
  }, [thread, selectedKey, userId, refreshConversations]);
  function choose(c: Conversation) {
    drafts.current.set(selectedKey, draft); setSelectedKey(keyOf(c)); setDraft(drafts.current.get(keyOf(c)) || ""); setThread([]); setError("");
    if (!adminMode) { const p = new URLSearchParams(window.location.search); p.set("tab", "mesajlar"); p.set("listingId", c.listing_id); p.set("peerId", c.peer_id); history.replaceState(null, "", `/hesabim?${p}`); }
  }
  async function older() {
    if (!selected || !thread.length || olderBusy) return;
    const key = keyOf(selected); setOlderBusy(true); const scroll = pane.current, previous = scroll?.scrollHeight || 0;
    try { const data = await jsonResponse(await fetch(`/api/messages?listingId=${encodeURIComponent(selected.listing_id)}&peerId=${selected.peer_id}&before=${thread[0].id}`, { cache: "no-store" })); if (selectedRef.current === key) { setThread(old=>merge(data.messages || [], old)); setHasOlder(!!data.hasMore); requestAnimationFrame(()=>{ if(scroll)scroll.scrollTop += scroll.scrollHeight - previous; }); } }
    catch(cause){setError(cause instanceof Error?cause.message:"Mesajlar yüklenemedi.");} finally {setOlderBusy(false);}
  }
  async function send(event?: React.FormEvent) {
    event?.preventDefault(); if (!selected || sending || draft.trim().length < 2) return;
    const key = keyOf(selected), body = draft.trim(); const retry = retries.current.get(key); const requestId = retry?.body === body ? retry.id : crypto.randomUUID();
    retries.current.set(key, { body, id: requestId }); setSending(true); setError("");
    try {
      const data = await jsonResponse(await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: selected.listing_id, peerId: selected.peer_id, message: body, requestId }) }));
      drafts.current.delete(key); retries.current.delete(key); window.dispatchEvent(new Event("messages:changed"));
      if (selectedRef.current === key) { setThread(old=>merge(old,[{ id:data.id || requestId,listing_id:selected.listing_id,sender_id:userId,recipient_id:selected.peer_id,body,created_at:data.createdAt || new Date().toISOString() }])); setDraft(""); }
      refreshConversations();
    } catch(cause){if(selectedRef.current===key)setError(cause instanceof Error?cause.message:"Mesaj gönderilemedi. Taslağınız korunuyor.");} finally {setSending(false);}
  }
  const visible = all.filter(c => (!unreadOnly || Number(c.unread_count)>0) && `${c.peer_name} ${c.peer_company || ""} ${c.listing_title} ${c.last_body}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));
  return <div className={`inbox message-center ${selected ? "has-selection" : ""}`} aria-label={t("Mesaj kutusu")}>
    <aside className="inbox-conversations"><div className="inbox-list-head"><strong>{t("Görüşmeler")}</strong><button type="button" onClick={()=>refreshConversations()} aria-label={t("Görüşmeleri yenile")}><RefreshCw size={16}/></button></div>
      <label className="message-search"><Search size={16}/><input aria-label={t("Görüşmelerde ara")} value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("Kişi veya görüşme ara")}/></label>
      <div className="message-filters"><button className={!unreadOnly?"active":""} onClick={()=>setUnreadOnly(false)}>{t("Tümü")}</button><button className={unreadOnly?"active":""} onClick={()=>setUnreadOnly(true)}>{t("Okunmamış")}</button></div>
      {listError && <p className="form-error" role="alert">{t(listError)}</p>}
      {!visible.length && <div className="message-list-empty"><Mail size={26}/><p>{t(search || unreadOnly ? "Aramanıza uygun görüşme yok." : "Henüz görüşme yok.")}</p>{!adminMode && <small>{t("İlan sahiplerine yazabilir veya yönetimden gelen mesajları burada yanıtlayabilirsiniz.")}</small>}</div>}
      {visible.map(c=><button type="button" key={keyOf(c)} className={`inbox-conversation ${selectedKey===keyOf(c)?"active":""} ${Number(c.unread_count)>0?"unread":""}`} onClick={()=>choose(c)} aria-pressed={selectedKey===keyOf(c)}><span className="inbox-avatar" aria-hidden="true">{c.peer_name.charAt(0).toLocaleUpperCase(locale)}</span><span className="inbox-conversation-copy"><strong>{c.peer_name}</strong><small>{c.listing_id.startsWith("admin:")?t("Yönetim · Destek"):c.listing_title}</small><span>{c.last_body}</span></span><span className="conversation-meta">{c.last_at&&<time dateTime={c.last_at}>{new Date(c.last_at).toLocaleDateString(locale,{day:"numeric",month:"short"})}</time>}{Number(c.unread_count)>0&&<b className="message-count" aria-label={t("{n} okunmamış mesaj").replace("{n}",String(c.unread_count))}>{Number(c.unread_count)>99?"99+":c.unread_count}</b>}</span></button>)}
      {hasMore&&<button className="message-load" onClick={()=>refreshConversations(page+1)}>{t("Daha fazla görüşme")}</button>}
    </aside>
    {selected ? <section className="inbox-thread"><div className="inbox-thread-head"><button className="message-back" aria-label={t("Görüşmelere dön")} onClick={()=>{drafts.current.set(selectedKey,draft);setSelectedKey("");}}><ChevronLeft size={20}/></button><div><span className={`message-thread-label ${support?"support":""}`}>{support&&<ShieldCheck size={13}/>} {t(support?"YÖNETİM · DESTEK":"İLAN GÖRÜŞMESİ")}</span><h3>{selected.peer_name}</h3><p>{selected.peer_company || selected.listing_title}</p></div>{selected.peer_whatsapp_phone&&<a className="inbox-whatsapp" href={whatsappHref(selected.peer_whatsapp_phone)} target="_blank" rel="noopener noreferrer" aria-label={t("WhatsApp’tan yaz")}><MessageCircle size={18}/><span>WhatsApp</span></a>}{selected.listing_status==="published"&&<Link href={`/ilan/${selected.listing_id}`} title={t("İlanı görüntüle")}><ArrowUpRight size={19}/></Link>}</div>
      <div className="inbox-thread-messages" ref={pane} role="log" aria-label={t("Konuşma geçmişi")} aria-live="polite">{hasOlder&&<button className="message-load" onClick={older} disabled={olderBusy}>{t(olderBusy?"Yükleniyor…":"Önceki mesajları yükle")}</button>}{loading?<p className="inbox-muted">{t("Mesajlar yükleniyor…")}</p>:!thread.length?<div className="message-welcome"><ShieldCheck size={28}/><strong>{t(support?"Yeni destek görüşmesi":"Görüşmeye başlayın")}</strong><p>{t("Mesajınız yalnızca bu görüşmenin diğer tarafına iletilir.")}</p></div>:thread.map(m=><div key={m.id} className={`inbox-bubble ${m.sender_id===userId?"mine":"theirs"}`}><p>{m.body}</p><div className="message-stamp"><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString(locale,{dateStyle:"short",timeStyle:"short"})}</time>{m.sender_id===userId&&<span title={t(m.read_at?"Okundu":"Gönderildi")} aria-label={t(m.read_at?"Okundu":"Gönderildi")}>{m.read_at?<CheckCheck size={15}/>:<Check size={15}/>}</span>}</div></div>)}<div ref={bottom}/></div>
      {selected.listing_status ? <div className="message-compose-wrap">{adminMode&&<div className="message-templates" aria-label={t("Mesaj şablonları")}>{["İlan düzenleme","Evrak talebi","Onay bilgisi"].map((label,i)=><button key={label} onClick={()=>{const templates=["Merhaba, ilanınızı incelememiz sırasında bazı bilgilerin güncellenmesi gerektiğini gördük. Lütfen aşağıdaki noktaları düzenleyip bize bilgi verin:\n\n","Merhaba, hesabınızın incelemesini tamamlayabilmemiz için eksik evraklar hakkında sizinle iletişime geçiyoruz. Lütfen aşağıdaki bilgileri kontrol edin:\n\n","Merhaba, hesabınız / ilanınız için inceleme süreciyle ilgili size bilgi vermek istiyoruz:\n\n"];setDraft(old=>old?old+"\n\n"+templates[i]:templates[i]);composer.current?.focus();}}>{t(label)}</button>)}</div>}<form className="inbox-compose" onSubmit={send}><label htmlFor={adminMode?"admin-message-draft":"inbox-draft"} className="sr-only">{t("Mesajınız")}</label><textarea ref={composer} id={adminMode?"admin-message-draft":"inbox-draft"} value={draft} disabled={sending} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();send();}}} minLength={2} maxLength={2000} rows={3} placeholder={t("Mesajınızı yazın…")} required/><button type="submit" disabled={sending||draft.trim().length<2||loading} aria-label={t("Mesaj gönder")}><Send size={18}/><span>{t(sending?"Gönderiliyor…":"Gönder")}</span></button></form><div className="message-compose-meta"><span>{t("Ctrl / ⌘ + Enter ile gönder")}</span><span>{draft.length}/2000</span></div></div>:<p className="inbox-muted">{t("Bu ilan artık mevcut değil. Yeni mesaj gönderilemez.")}</p>}
      {error&&<div className="message-send-error" role="alert"><span>{t(error)}</span><button onClick={()=>setRefresh(n=>n+1)}>{t("Yeniden yükle")}</button></div>}
    </section>:<div className="message-no-selection"><Mail size={40}/><h3>{t(adminMode?"Mesaj merkezi":"Mesajlarınız")}</h3><p>{t(adminMode?"Bir görüşme seçin veya yeni mesaj için bir alıcı bulun.":"Konuşma geçmişini görmek ve yanıtlamak için bir görüşme seçin.")}</p><small>{t("Görüşmeler açıkken otomatik yenilenir.")}</small></div>}
  </div>;
}




