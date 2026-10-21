'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Check,Globe2,House,LoaderCircle,MapPin,MessageSquare,Plus,Send,Sparkles} from 'lucide-react';
import Link from './SafeLink';
import {useLocale,locales} from '@/lib/i18n';
import {assistantCopy,assistantMemberCopy} from '@/lib/assistant-copy';
import {emptyFilters,type AssistantFilters,type AssistantLanguage} from '@/lib/assistant';
import {formatPrice,type Listing} from '@/lib/listings';
type Turn={role:'user'|'assistant';text:string};
type Answer={message:string;language:AssistantLanguage;filters:AssistantFilters;unverified:string[];listings:Listing[];total:number;href:string;searched?:boolean};
const propertyNames:Record<AssistantLanguage,string[]>={tr:['Daire','Villa','Müstakil ev','Rezidans','Arsa','Ticari'],en:['Apartment','Villa','Detached house','Residence','Land','Commercial'],de:['Wohnung','Villa','Einfamilienhaus','Residenz','Grundstück','Gewerbe'],ar:['شقة','فيلا','منزل مستقل','مجمع سكني','أرض','تجاري'],fr:['Appartement','Villa','Maison','Résidence','Terrain','Commercial'],ru:['Квартира','Вилла','Дом','Резиденция','Участок','Коммерческая']};
const propertyKeys=['daire','villa','mustakil','rezidans','arsa','ticari'];
export function EstateAssistant({embedded=false}:{embedded?:boolean}){
 const {locale}=useLocale();
 const [selected,setSelected]=useState<'auto'|AssistantLanguage>('auto'),[detected,setDetected]=useState<AssistantLanguage|null>(null);
 const language=selected==='auto'?(detected||locale):selected,copy=assistantCopy[language];
 const [available,setAvailable]=useState<boolean|null>(null),[authenticated,setAuthenticated]=useState<boolean|null>(null),[draft,setDraft]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[answer,setAnswer]=useState<Answer|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(''),[error,setError]=useState('');
 const [filters,setFilters]=useState(emptyFilters),end=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),controller=useRef<AbortController|null>(null);
 useEffect(()=>{let active=true;const check=()=>fetch('/api/assistant',{cache:'no-store'}).then(r=>r.json() as Promise<{available:boolean;authenticated:boolean}>).then(d=>{if(active){setAvailable(d.available===true);setAuthenticated(d.authenticated===true);if(!d.authenticated){controller.current?.abort();setTurns([]);setAnswer(null);setFilters(emptyFilters());setBusy(false);setPending('');setDraft('');}}}).catch(()=>{if(active)setAvailable(false);});check();window.addEventListener('salesorrent:profile-changed',check);const interval=setInterval(check,30000);return()=>{active=false;clearInterval(interval);window.removeEventListener('salesorrent:profile-changed',check);controller.current?.abort();};},[]);
 useEffect(()=>{if(turns.length||pending)end.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[turns,pending]);
 function reset(){controller.current?.abort();setTurns([]);setAnswer(null);setFilters(emptyFilters());setError('');setDraft('');setDetected(null);setBusy(false);setPending('');input.current?.focus();}
 async function send(text=draft){
  const message=text.trim();if(!message||busy||!available)return;
  const cancel=new AbortController();controller.current=cancel;setBusy(true);setError('');setPending(message);
  try{
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:selected,uiLanguage:language,history:turns.slice(-8).map(m=>({...m,text:m.text.slice(0,1200)})),filters,shownIds:answer?.listings.map(l=>l.id)||[]}),signal:cancel.signal});
   const data=await response.json() as Answer&{error?:string};
   if(!response.ok){if(response.status===401){setAuthenticated(false);setAvailable(false);throw Error(assistantMemberCopy[language].required);}const key=data.error as keyof typeof copy;throw Error(typeof copy[key]==='string'?String(copy[key]):copy.unavailable);}
   setTurns(previous=>[...previous,{role:'user',text:message},{role:'assistant',text:data.message}].slice(-20) as Turn[]);setDraft('');setDetected(data.language);setFilters(data.filters);
   // Clarifications keep the last verified results available for follow-up questions.
   if(data.total>0||data.searched)setAnswer(data);else if(data.listings.length)setAnswer(data);
   else if(data.message===assistantCopy[data.language].none)setAnswer(data);
  }catch(cause){if(!cancel.signal.aborted){setError(cause instanceof Error?cause.message:copy.unavailable);setDraft(message);}}
  finally{if(!cancel.signal.aborted){setBusy(false);setPending('');input.current?.focus();}}
 }
 const chips=[filters.purpose?copy[filters.purpose==='satilik'?'sale':'rent']:null,filters.city,filters.district,filters.type?propertyNames[language][propertyKeys.indexOf(filters.type)]:null,filters.rooms,filters.bedrooms!==null?`${filters.bedrooms} ${copy.bedrooms}`:null,filters.maxPrice!==null?`≤ ${filters.maxPrice.toLocaleString(language)} ${filters.currency||'?'}`:null,filters.minPrice!==null?`≥ ${filters.minPrice.toLocaleString(language)} ${filters.currency||'?'}`:null,filters.minArea!==null?`≥ ${filters.minArea} m²`:null,filters.maxArea!==null?`≤ ${filters.maxArea} m²`:null,filters.furnished!==null?(filters.furnished?copy.furnished:copy.notFurnished):null,...filters.amenities].filter(Boolean);
 const Root=embedded?'section':'main',Title=embedded?'h2':'h1',member=assistantMemberCopy[language];
 return <Root id="ev-asistani" className={`estate-assistant${embedded?' assistant-embedded':''}`} dir={language==='ar'?'rtl':'ltr'}>
  <div className="assistant-heading"><div><span className="assistant-eyebrow"><Sparkles size={15}/>{copy.badge}<b>{member.badge}</b></span><Title>{copy.title}</Title><p>{copy.subtitle}</p></div><div className="assistant-language"><Globe2 size={17}/><label className="sr-only" htmlFor="assistant-language">{copy.language}</label><select id="assistant-language" value={selected} onChange={e=>setSelected(e.target.value as typeof selected)}><option value="auto">{copy.auto}</option>{locales.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></div></div>
  {authenticated===false&&<div className="assistant-member-gate"><div><strong>{member.badge}</strong><p>{member.required}</p></div><Link href={`/giris?next=${encodeURIComponent(embedded?'/#ev-asistani':'/asistan')}`}>{member.login}<ArrowRight size={17}/></Link></div>}
  <div className="assistant-workspace">
   <section className="assistant-chat" aria-label={copy.badge}>
    <header className="assistant-chat-top"><span><span className="assistant-avatar"><Sparkles size={19}/></span><strong>estate<span>market</span>24</strong></span><button type="button" onClick={reset} disabled={busy}><Plus size={16}/>{copy.reset}</button></header>
    <div className="assistant-transcript" role="log" aria-live="polite" aria-relevant="additions text"><div className="assistant-bubble assistant-bot" dir="auto">{copy.welcome}</div>
     {!turns.length&&!busy&&<div className="assistant-prompts">{copy.samples.map(sample=><button type="button" key={sample} onClick={()=>{setDraft(sample);input.current?.focus();}}><MessageSquare size={15}/><span>{sample}</span><ArrowUpRight size={15}/></button>)}</div>}
     {turns.map((turn,i)=><div key={i} className={`assistant-bubble ${turn.role==='user'?'assistant-user':'assistant-bot'}`} dir="auto">{turn.text}</div>)}
     {pending&&<div className="assistant-bubble assistant-user" dir="auto">{pending}</div>}{busy&&<div className="assistant-thinking"><LoaderCircle className="assistant-spin" size={17}/>{copy.thinking}</div>}<div ref={end}/>
    </div>
    <div className="assistant-composer">{authenticated===true&&available===false&&<div className="assistant-setup" role="status">{copy.setup} <Link href="/ilanlar"><ArrowRight size={15}/></Link></div>}{error&&<p className="assistant-error" role="alert">{error}</p>}
     <form onSubmit={e=>{e.preventDefault();void send();}}><label className="sr-only" htmlFor="assistant-message">{copy.placeholder}</label><textarea ref={input} id="assistant-message" dir="auto" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} placeholder={authenticated===false?member.required:copy.placeholder} disabled={busy||authenticated!==true} rows={2} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button type="submit" disabled={!authenticated||!available||busy||!draft.trim()} aria-label={copy.send}>{busy?<LoaderCircle className="assistant-spin" size={20}/>:<Send size={20}/>}</button></form>
     <p>{copy.privacy}</p>
    </div>
   </section>
   <section className="assistant-matches" aria-label={copy.results} aria-busy={busy}>
    <div className="assistant-results-top"><h2><House size={20}/>{copy.results}</h2>{answer?.total? <span>{answer.total}</span>:null}</div>
    {chips.length>0&&<div className="assistant-criteria"><small>{copy.filters}</small><div>{chips.map((chip,i)=><span key={i}>{chip}</span>)}</div></div>}
    {!!answer?.unverified.length&&<div className="assistant-unverified"><strong>{copy.unverified}</strong><span>{answer.unverified.join(' · ')}</span></div>}
    {!answer?.listings.length?<div className="assistant-empty"><div className="assistant-house-art"><House size={45} strokeWidth={1.2}/><span><Sparkles size={19}/></span></div><h3>{copy.results}</h3><p>{answer?.total===0?copy.none:copy.empty}</p><div className="assistant-empty-tags"><span>Türkçe</span><span>English</span><span>Deutsch</span><span>العربية</span></div></div>:<>
     <div className="assistant-result-list">{answer.listings.map(listing=><article className="assistant-result" key={listing.id}><Link className="assistant-result-image" href={`/ilan/${listing.id}`}>{listing.images[0]?<img src={listing.images[0]} alt={listing.title} loading="lazy"/>:<House size={30}/>}<span>{listing.purpose==='satilik'?copy.sale:copy.rent}</span></Link><div><small><MapPin size={12}/>{listing.district}, {listing.city}</small><Link className="assistant-result-title" href={`/ilan/${listing.id}`}>{listing.title}</Link><strong className="assistant-price">{formatPrice(listing.price,listing.currency,language)}</strong><p className="assistant-property-facts"><span>{listing.grossArea} m²</span>{listing.rooms&&<span>{listing.rooms}</span>}{listing.bedrooms!==undefined&&<span>{listing.bedrooms} {copy.bedrooms}</span>}</p><Link className="assistant-view" href={`/ilan/${listing.id}`}>{copy.view}<ArrowUpRight size={14}/></Link></div></article>)}</div>
     <div className="assistant-result-actions"><Link href={answer.href}><MapPin size={16}/>{copy.browse}</Link>{answer.listings.length>1&&<button type="button" disabled={busy||!available} onClick={()=>void send(copy.compare)}>{copy.compare}<ArrowRight size={16}/></button>}</div>
    </>}
    <p className="assistant-accuracy"><Check size={15}/>{copy.accuracy}</p>
   </section>
  </div>
 </Root>;
}
