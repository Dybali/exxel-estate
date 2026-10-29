"use client";
import { useEffect, useState } from "react";
import { MailPlus, Search, ShieldCheck, Users, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { MessagesInbox, type Conversation, type MessageRecipient } from "./MessagesInbox";
type Recipient = MessageRecipient & { email: string; agent_status: string };
export function AdminMessages({ recipient, onUnreadChange }: { recipient?: MessageRecipient | null; onUnreadChange?: (count: number) => void }) {
  const { t } = useLocale();
  const [account, setAccount] = useState<{id:string}|null>(null), [initial, setInitial] = useState<Conversation[]>([]), [initializing,setInitializing]=useState(true);
  const [directory,setDirectory]=useState(false), [query,setQuery]=useState(""), [role,setRole]=useState("all"), [page,setPage]=useState(1);
  const [users,setUsers]=useState<Recipient[]>([]), [hasMore,setHasMore]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [chosen,setChosen]=useState<MessageRecipient|null>(null), [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setInitializing(true);Promise.all([fetch('/api/account',{cache:'no-store'}).then(async r=>await r.json() as { user?: {id:string} }),fetch('/api/messages',{cache:'no-store'}).then(async r=>{const d=await r.json() as { error?:string; conversations?:Conversation[]; users?:Recipient[]; hasMore?:boolean };if(!r.ok)throw Error(d.error||'Mesajlar yüklenemedi.');return d;})]).then(([a,m])=>{if(active){setAccount(a.user||null);setInitial(m.conversations||[]);setError("");}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setInitializing(false);});return()=>{active=false;};},[retry]);
  useEffect(()=>{if(recipient){setChosen(recipient);setDirectory(false);}},[recipient]);
  useEffect(()=>{
    if(!directory)return;
    const control=new AbortController();setBusy(true);setError("");
    const timer=setTimeout(async()=>{try{const p=new URLSearchParams({directory:'1',q:query,role,page:String(page)});const r=await fetch(`/api/messages?${p}`,{cache:'no-store',signal:control.signal});const d=await r.json() as { error?:string; conversations?:Conversation[]; users?:Recipient[]; hasMore?:boolean };if(!r.ok)throw Error(d.error||'Alıcılar yüklenemedi.');if(!control.signal.aborted){setUsers(d.users||[]);setHasMore(!!d.hasMore);}}catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Alıcılar yüklenemedi.');}finally{if(!control.signal.aborted)setBusy(false);}},250);
    return()=>{clearTimeout(timer);control.abort();};
  },[directory,query,role,page,retry]);
  return <section className="admin-message-section" id="admin-message-center" aria-label={t("Yönetici mesaj merkezi")}>
    <div className="admin-section-head"><div><span className="eyebrow dark-eyebrow">{t("İLETİŞİM")}</span><h2>{t("Mesaj merkezi")}</h2><p>{t("İlan sahipleri ve emlakçılarla doğrudan iletişim kurun.")}</p></div><button type="button" className="primary-button" onClick={()=>setDirectory(true)}><MailPlus size={18}/> {t("Yeni mesaj")}</button></div>
    <div className="admin-message-notice"><ShieldCheck size={18}/><span>{t("Mesajlar alıcının")} <strong>{t("Hesabım → Mesajlarım")}</strong> {t("bölümüne iletilir. Burada yalnızca katıldığınız görüşmeler görünür.")}</span></div>
    {directory&&<div className="message-directory"><div className="message-directory-head"><div><Users size={19}/><strong>{t("Alıcı seçin")}</strong></div><button aria-label={t("Alıcı seçimini kapat")} onClick={()=>setDirectory(false)}><X size={20}/></button></div>
      <div className="message-directory-filters"><label className="message-search"><Search size={17}/><input autoFocus aria-label={t("Üye ara")} placeholder={t("Ad, e-posta veya şirket adı")} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><select aria-label={t("Alıcı hesap türü")} value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="all">{t("Tüm üyeler")}</option><option value="agent">{t("Emlakçılar / şirketler")}</option><option value="individual">{t("Bireysel ilan sahipleri")}</option><option value="buyer">{t("Alıcılar")}</option></select></div>
      <div className="message-directory-results" aria-busy={busy}>{busy?<p>{t("Alıcılar yükleniyor…")}</p>:users.length?users.map(u=><button key={u.id} className="message-recipient" onClick={()=>{setChosen({...u});setDirectory(false);}}><span className="inbox-avatar">{u.name.slice(0,1).toLocaleUpperCase('tr')}</span><span><strong>{u.name}</strong><small>{u.company||u.email}</small></span><span className="message-role">{t(u.role==='agent'?'Emlakçı':u.role==='individual'?'İlan sahibi':'Üye')}</span><MailPlus size={18}/></button>):<p>{t("Bu aramaya uygun üye bulunamadı.")}</p>}</div>
      <div className="message-directory-pages"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1||busy}>{t("Önceki")}</button><span>{t("Sayfa {n}").replace("{n}", String(page))}</span><button onClick={()=>setPage(p=>p+1)} disabled={!hasMore||busy}>{t("Sonraki")}</button></div>
    </div>}
    {error&&<div className="message-send-error" role="alert"><span>{t(error)}</span><button onClick={()=>setRetry(n=>n+1)}>{t("Yeniden dene")}</button></div>}
    {initializing?<div className="message-initializing">{t("Mesaj merkezi yükleniyor…")}</div>:account&&<MessagesInbox userId={account.id} initialConversations={initial} adminMode newRecipient={chosen} onUnreadChange={onUnreadChange}/>}
  </section>;
}

