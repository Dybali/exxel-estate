"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {LoaderCircle,Search,SlidersHorizontal,Sparkles,X} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {useDisplayCurrency} from "./DisplayCurrency";

// Natural-language search box (lib/nl-search.ts, POST /api/search/parse). On the home page it opens
// /ilanlar with the recognised filters; on /ilanlar it applies them in place through onApply. The last
// result is kept in sessionStorage so /ilanlar can show what was understood after the navigation.
type Chip={key:string;label:string};
type Result={url:string;chips:Chip[];ignored:string[];unsupported:string[];ai:string};
const STORE="em24:nl-search";
const normal=(url:string)=>{const params=new URLSearchParams(url.split("?")[1]||"");for(const key of ["lang","sort","view","page"])params.delete(key);params.sort();return params.toString();};
// Home page: example searches typed into the empty box one after another (owner's request 2026-11-17).
// Stops while the visitor types or the box has focus; reduced motion shows the usual static placeholder.
export const TYPING_EXAMPLES=["Bodrum'da deniz manzaralı, havuzlu villa","İzmir'de krediye uygun 3+1 daire, 6 milyona kadar","İstanbul Kadıköy'de metroya yakın kiralık 2+1","Antalya'da yatırım için satılık arsa"] as const;
function useTypingPlaceholder(examples:string[],enabled:boolean){
 const [shown,setShown]=useState<string|null>(null);
 useEffect(()=>{
  if(!enabled||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  let example=0,length=0,deleting=false,timer=0;
  const step=()=>{const target=examples[example];
   if(!deleting){length++;setShown(target.slice(0,length));if(length>=target.length){deleting=true;timer=window.setTimeout(step,2200);return;}timer=window.setTimeout(step,55);}
   else{length=Math.max(0,length-3);setShown(target.slice(0,length));if(length===0){deleting=false;example=(example+1)%examples.length;timer=window.setTimeout(step,500);return;}timer=window.setTimeout(step,25);}};
  timer=window.setTimeout(step,1200);
  return()=>window.clearTimeout(timer);
 },[examples,enabled]);
 return shown;
}
const validResult=(value:unknown):value is Result=>{const r=value as Result;return Boolean(r&&typeof r.url==="string"&&r.url.startsWith("/ilanlar")&&Array.isArray(r.chips)&&Array.isArray(r.ignored)&&Array.isArray(r.unsupported));};

export function NaturalSearch({variant,current,onApply,onEdit}:{variant:"home"|"listings";current?:string;onApply?:(url:string)=>void;onEdit?:()=>void}){
 const {t,locale}=useLocale();const display=useDisplayCurrency();
 const [text,setText]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null),[error,setError]=useState("");
 // One box per page: fixed ids keep server and client markup identical.
 const id=`nl-search-${variant}`,controller=useRef<AbortController|null>(null);
 const [focused,setFocused]=useState(false),[examples]=useState(()=>TYPING_EXAMPLES.map(item=>t(item)));
 const typing=useTypingPlaceholder(examples,variant==="home"&&!focused&&!text);
 useEffect(()=>{
  if(variant!=="listings")return;
  try{const saved=JSON.parse(window.sessionStorage.getItem(STORE)||"null");if(saved&&validResult(saved.result)&&normal(saved.result.url)===normal(window.location.search)){setText(String(saved.query||"").slice(0,300));setResult(saved.result);}}catch{/* storage unavailable */}
  return()=>controller.current?.abort();
 },[variant]);
 // Back from /ilanlar through the browser cache: the box is usable again.
 useEffect(()=>{const reset=(event:PageTransitionEvent)=>{if(event.persisted)setBusy(false);};window.addEventListener("pageshow",reset);return()=>window.removeEventListener("pageshow",reset);},[]);
 // Filters changed by hand after the search: the summary no longer describes the list.
 const shown=result&&(current===undefined||normal(result.url)===normal("?"+current))?result:null;
 function clear(){setResult(null);setText("");setError("");try{window.sessionStorage.removeItem(STORE);}catch{/* ignore */}}
 async function submit(event:FormEvent){
  event.preventDefault();const query=text.trim();if(!query||busy)return;
  controller.current?.abort();const cancel=new AbortController();controller.current=cancel;setBusy(true);setError("");
  let leaving=false;
  try{
   const response=await fetch("/api/search/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,locale,currency:display.supported?display.currency:"TRY"}),signal:cancel.signal});
   const data=await response.json().catch(()=>null) as (Result&{message?:string})|null;
   if(!response.ok||!validResult(data)){setError(typeof data?.message==="string"&&data.message?data.message:t("Arama şu anda çözümlenemedi. Lütfen tekrar deneyin."));return;}
   try{window.sessionStorage.setItem(STORE,JSON.stringify({query,result:data}));}catch{/* storage unavailable */}
   setResult(data);
   // A shared ?lang link keeps its language on /ilanlar (server-rendered title and metadata).
   const lang=new URLSearchParams(window.location.search).get("lang");
   if(onApply)onApply(data.url);else{leaving=true;window.location.assign(lang&&/^[a-z]{2}$/.test(lang)?`${data.url}${data.url.includes("?")?"&":"?"}lang=${lang}`:data.url);}
  }catch{if(!cancel.signal.aborted)setError(t("Arama şu anda çözümlenemedi. Lütfen tekrar deneyin."));}
  // Home page: stays busy while the browser opens /ilanlar.
  finally{if(!cancel.signal.aborted&&!leaving)setBusy(false);}
 }
 return <section className={`nl-search nl-search-${variant}`} aria-labelledby={`${id}-label`}>
  <form role="search" className="nl-search-form" onSubmit={submit}>
   <label id={`${id}-label`} htmlFor={`${id}-input`} className="nl-search-label"><Sparkles size={14} aria-hidden="true"/><span>{t("Doğal dil araması")}</span><small>estateAI</small></label>
   <div className="nl-search-field">
    <Sparkles className="nl-search-icon" size={18} aria-hidden="true"/>
    <input id={`${id}-input`} type="search" dir="auto" enterKeyHint="search" autoComplete="off" maxLength={300} value={text} onChange={event=>setText(event.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} placeholder={typing?`${typing}▍`:t("Ne arıyorsunuz? Örn: Bodrum’da havuzlu 3+1 satılık villa, 15 milyona kadar")} aria-describedby={`${id}-hint`}/>
    <button type="submit" className="nl-search-submit" disabled={busy||!text.trim()} aria-busy={busy}>{busy?<LoaderCircle className="nl-search-spin" size={18} aria-hidden="true"/>:<Search size={18} aria-hidden="true"/>}<span>{t("Ara")}</span></button>
   </div>
   <p id={`${id}-hint`} className="nl-search-hint">{t("Kişisel bilgi yazmayın. Anlaşılmayan kısımlar gerekirse Google Gemini ile yorumlanır.")}</p>
  </form>
  {error&&<p className="nl-search-error" role="alert">{error}</p>}
  <div className="nl-search-result" role="status" aria-live="polite">
   {busy&&<span className="sr-only">{t("Aramanız çözümleniyor…")}</span>}
   {shown&&!busy&&<div className="nl-search-summary">
    {shown.chips.length?<>
     <ul className="nl-search-chips" aria-label={t("Anlaşılan ölçütler")}>{shown.chips.map(chip=><li key={chip.key} dir="auto">{chip.label}</li>)}</ul>
     <span className="sr-only">{t("{count} ölçüt uygulandı.").replace("{count}",String(shown.chips.length))}</span>
    </>:<p className="nl-search-note">{t("Hiçbir ölçüt anlaşılamadı. Başka sözcüklerle deneyin veya filtreleri kullanın.")}</p>}
    {shown.ai==="used"&&<p className="nl-search-ai"><Sparkles size={12} aria-hidden="true"/>{t("Yapay zekâ ile yorumlandı")}</p>}
    {shown.unsupported.length>0&&<p className="nl-search-note"><bdi>{t("Filtre olarak uygulanamayanlar: {words}").replace("{words}",shown.unsupported.join(", "))}</bdi></p>}
    {shown.ignored.length>0&&<p className="nl-search-note"><bdi>{t("Anlaşılamayan ifadeler: {words}").replace("{words}",shown.ignored.join(", "))}</bdi></p>}
    <div className="nl-search-actions">
     {onEdit&&<button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}><SlidersHorizontal size={15} aria-hidden="true"/>{t("Filtreleri düzenle")}</button>}
     <button type="button" className="btn btn-ghost btn-sm" onClick={clear}><X size={15} aria-hidden="true"/>{t("Aramayı temizle")}</button>
    </div>
   </div>}
  </div>
 </section>;
}
