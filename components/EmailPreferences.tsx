"use client";
import {useEffect,useState} from "react";
import {Mail} from "lucide-react";
import {apiJson} from "@/lib/api-client";
import {useLocale} from "@/lib/i18n";

type Prefs={messages:boolean;alerts:boolean;configured:boolean};

// Email channel for new messages and the daily saved-search / price digest.
export function EmailPreferences(){
 const {t}=useLocale(),[prefs,setPrefs]=useState<Prefs|null>(null),[status,setStatus]=useState("");
 useEffect(()=>{fetch("/api/email/preferences",{cache:"no-store"}).then(r=>r.ok?apiJson<Prefs>(r):null).then(setPrefs).catch(()=>{});},[]);
 async function change(key:"messages"|"alerts",value:boolean){if(!prefs)return;const previous=prefs;setPrefs({...prefs,[key]:value});setStatus("");
  try{const r=await fetch("/api/email/preferences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({[key]:value})});if(!r.ok)throw Error();setStatus(t("Kaydedildi."));}catch{setPrefs(previous);setStatus(t("Kaydedilemedi."));}}
 if(!prefs)return null;
 return <section className="email-preferences"><h3><Mail size={17}/>{t("E-posta bildirimleri")}</h3>
  <label><input type="checkbox" checked={prefs.messages} onChange={e=>change("messages",e.target.checked)}/>{t("Yeni mesaj geldiğinde e-posta gönder")}</label>
  <label><input type="checkbox" checked={prefs.alerts} onChange={e=>change("alerts",e.target.checked)}/>{t("Kayıtlı aramalarıma uyan yeni ilanları ve favorilerimdeki fiyat değişikliklerini günlük e-postayla gönder")}</label>
  {!prefs.configured&&<p className="email-preferences-note">{t("E-posta gönderimi henüz etkin değil; tercihleriniz kaydedilir ve etkinleştiğinde uygulanır.")}</p>}
  {status&&<p role="status" className="email-preferences-note">{status}</p>}
 </section>;
}
