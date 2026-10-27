'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Globe2,LoaderCircle,Plus,Send,Sparkles,X} from 'lucide-react';
import Link from './SafeLink';
import {useLocale,locales} from '@/lib/i18n';
import {assistantCopy,assistantMemberCopy,assistantResultLabel} from '@/lib/assistant-copy';
import {assistantHistory,emptyFilters,type AssistantFilters,type AssistantLanguage} from '@/lib/assistant';
import {type Listing} from '@/lib/listings';
type Turn={role:'user'|'assistant';text:string;href?:string;resultLabel?:string;unverified?:string[]};
type Answer={message:string;language:AssistantLanguage;filters:AssistantFilters;unverified:string[];listings:Listing[];total:number;href:string;searched?:boolean};
export function EstateAssistant({compact=false,onClose}:{compact?:boolean;onClose?:()=>void}){
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
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:selected,uiLanguage:language,history:assistantHistory(turns),filters,shownIds:answer?.listings.map(l=>l.id)||[]}),signal:cancel.signal});
   const data=await response.json() as Answer&{error?:string};
   if(!response.ok){if(response.status===401){setAuthenticated(false);setAvailable(false);throw Error(assistantMemberCopy[language].required);}const key=data.error as keyof typeof copy;throw Error(typeof copy[key]==='string'?String(copy[key]):copy.unavailable);}
   setTurns(previous=>[...previous,{role:'user',text:message},{role:'assistant',text:data.message,...(data.searched&&data.total>0?{href:data.href,resultLabel:assistantResultLabel(data.language,data.total)}:{}),unverified:data.unverified}].slice(-20) as Turn[]);setDraft('');setDetected(data.language);setFilters(data.filters);
   // Clarifications keep the last verified results available for follow-up questions.
   if(data.total>0||data.searched)setAnswer(data);else if(data.listings.length)setAnswer(data);
   else if(data.message===assistantCopy[data.language].none)setAnswer(data);
  }catch(cause){if(!cancel.signal.aborted){setError(cause instanceof Error?cause.message:copy.unavailable);setDraft(message);}}
  finally{if(!cancel.signal.aborted){setBusy(false);setPending('');input.current?.focus();}}
 }

 const member=assistantMemberCopy[language];
 const closeLabel={tr:'Kapat',en:'Close',de:'Schließen',ar:'إغلاق',fr:'Fermer',ru:'Закрыть'}[language];
 return <section className={'estate-assistant assistant-text-only'+(compact?' assistant-compact':'')} dir={language==='ar'?'rtl':'ltr'}>
  <section className="assistant-chat" aria-label={copy.badge}>
   <header className="assistant-chat-top"><span><span className="assistant-avatar"><Sparkles size={21}/></span><span className="assistant-chat-name"><strong>{copy.launcher}</strong><small>{member.badge}</small></span></span><div className="assistant-header-actions"><button type="button" onClick={reset} disabled={busy} aria-label={copy.reset} title={copy.reset}><Plus size={18}/></button>{onClose&&<button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}><X size={22}/></button>}</div></header>
   <div className="assistant-chat-language"><Globe2 size={14}/><label htmlFor="assistant-language">{copy.language}</label><select id="assistant-language" value={selected} onChange={e=>setSelected(e.target.value as typeof selected)}><option value="auto">{copy.auto}</option>{locales.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
   <div className="assistant-transcript" role="log" aria-live="polite" aria-relevant="additions text">
    {!turns.length&&!busy&&<><div className="assistant-intro"><h2>{copy.title}</h2><p>{copy.subtitle}</p></div><div className="assistant-prompts">{copy.samples.map(sample=><button type="button" key={sample} onClick={()=>{setDraft(sample);input.current?.focus();}}><Sparkles size={19}/><span>{sample}</span><ArrowRight size={14}/></button>)}</div></>}
    {turns.map((turn,i)=><div key={i} className={'assistant-bubble '+(turn.role==='user'?'assistant-user':'assistant-bot')} dir="auto"><span>{turn.text}</span>{!!turn.unverified?.length&&<small className="assistant-result-warning">{copy.unverified} {turn.unverified.join(' · ')}</small>}{turn.href&&<Link className="assistant-results-link" href={turn.href}>{turn.resultLabel}<ArrowRight size={16}/></Link>}</div>)}
    {pending&&<div className="assistant-bubble assistant-user" dir="auto">{pending}</div>}{busy&&<div className="assistant-thinking"><LoaderCircle className="assistant-spin" size={17}/>{copy.thinking}</div>}<div ref={end}/>
   </div>
   <div className="assistant-composer">
    {authenticated===false&&<div className="assistant-member-gate"><p>{member.required}</p><Link href="/giris?next=%2F%3Fassistant%3D1">{member.login}<ArrowRight size={15}/></Link></div>}
    {authenticated===true&&available===false&&<div className="assistant-setup" role="status">{copy.setup}</div>}{error&&<p className="assistant-error" role="alert">{error}</p>}
    <form onSubmit={e=>{e.preventDefault();void send();}}><label className="sr-only" htmlFor="assistant-message">{copy.placeholder}</label><textarea ref={input} id="assistant-message" dir="auto" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} placeholder={authenticated===false?member.required:copy.placeholder} disabled={busy||authenticated!==true} rows={2} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button type="submit" disabled={!authenticated||!available||busy||!draft.trim()} aria-label={copy.send}>{busy?<LoaderCircle className="assistant-spin" size={20}/>:<Send size={20}/>}</button></form>
    <p>{copy.privacy}</p>
   </div>
  </section>
 </section>;
}
