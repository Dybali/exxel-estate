"use client";
import {apiJson} from '@/lib/api-client';

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { MessageCircle, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { phonePlaceholder } from "@/lib/phone";

type Account={id:string;name:string;phone?:string|null;whatsapp_enabled?:number};
export function WhatsAppPrompt(){
  const {t,locale}=useLocale();
  const [user,setUser]=useState<Account|null>(null),[phone,setPhone]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let live=true;const sync=()=>fetch("/api/account",{cache:"no-store"}).then((response)=>apiJson<{user?:Account}>(response)).then((data:{user?:Account})=>{if(!live)return;const account=data.user||null;if(!account||account.whatsapp_enabled){setUser(null);return;}try{if(localStorage.getItem(`salesorrent:whatsapp-prompt:${account.id}`)){setUser(null);return;}}catch{}setUser(account);setPhone(account.phone||"");}).catch(()=>{});sync();window.addEventListener("salesorrent:profile-changed",sync);return()=>{live=false;window.removeEventListener("salesorrent:profile-changed",sync);};},[]);
  function dismiss(){if(user)try{localStorage.setItem(`salesorrent:whatsapp-prompt:${user.id}`,"1");}catch{}setUser(null);}
  async function enable(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!user)return;setBusy(true);setError("");try{const response=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_profile",phone,whatsappEnabled:true})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||t("WhatsApp etkinleştirilemedi."));dismiss();window.dispatchEvent(new Event("salesorrent:profile-changed"));}catch(cause){setError(cause instanceof Error?cause.message:t("WhatsApp etkinleştirilemedi."));}finally{setBusy(false);}}
  if(!user)return null;
  return <aside className="whatsapp-prompt" aria-label={t("WhatsApp iletişimi")}><button type="button" className="whatsapp-prompt-close" onClick={dismiss} aria-label={t("Kapat")}><X size={17}/></button><div className="whatsapp-prompt-icon"><MessageCircle size={22}/></div><h2>{t("WhatsApp iletişimini açmak ister misiniz?")}</h2><p>{t("Numaranızı ekleyin; ilanlarınız veya görüşmeleriniz için ilgili üyeler size WhatsApp üzerinden doğrudan ulaşabilsin.")}</p><form onSubmit={enable}><label>{t("Telefon numarası")}<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder={phonePlaceholder(locale)} required/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy?t("Kaydediliyor..."):t("WhatsApp'ı etkinleştir")}</button></form><div className="whatsapp-prompt-foot"><button type="button" onClick={dismiss}>{t("Şimdi değil")}</button><Link href="/hesabim?tab=profil" onClick={dismiss}>{t("Profilimde düzenle")}</Link></div></aside>;
}
