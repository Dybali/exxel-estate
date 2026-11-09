'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {CheckCircle2,Lightbulb,X} from 'lucide-react';
import Link from './SafeLink';
import {useLocale} from '@/lib/i18n';
import {FEEDBACK_KINDS,FEEDBACK_LIMITS,FEEDBACK_TOPICS,type FeedbackKind,type FeedbackSource,type FeedbackTopic} from '@/lib/feedback';

// "Öneri ve geri bildirim": a small floating button (bottom left, opposite the estateAI launcher, which
// sits bottom right in both text directions), the footer links and the Hesabım cards all open this one
// dialog through openFeedback(). Native <dialog>.showModal() makes the rest of the page inert (focus
// trap) and closes on Escape; focus returns to the element that opened it.
const EVENT='em24:feedback';
export function openFeedback(source:FeedbackSource='widget'){window.dispatchEvent(new CustomEvent(EVENT,{detail:{source}}));}
const viewport=()=>{const w=window.innerWidth;return w<768?'mobile':w<1100?'tablet':'desktop';};
type Account={email:string;email_verified:number};

export function FeedbackWidget({launcher=true,defaultSource='widget'}:{launcher?:boolean;defaultSource?:FeedbackSource}){
 const {t,locale}=useLocale(),path=usePathname();
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),openedAt=useRef(0),message=useRef<HTMLTextAreaElement>(null);
 const [open,setOpen]=useState(false),[source,setSource]=useState<FeedbackSource>(defaultSource),[account,setAccount]=useState<Account|null>(null);
 const [kind,setKind]=useState<FeedbackKind>('idea'),[topic,setTopic]=useState<FeedbackTopic>('listings'),[text,setText]=useState(''),[rating,setRating]=useState(0);
 const [reply,setReply]=useState(false),[email,setEmail]=useState(''),[consent,setConsent]=useState(false),[website,setWebsite]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const show=useCallback((from:FeedbackSource)=>{
  opener.current=document.activeElement as HTMLElement|null;setSource(from);setOpen(true);setDone(false);setError('');openedAt.current=performance.now();
  fetch('/api/account',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{user?:Account}>:null).then(d=>{const user=d?.user;setAccount(user&&user.email_verified?user:null);if(user?.email_verified)setEmail(user.email);}).catch(()=>{});
 },[]);
 useEffect(()=>{const listen=(event:Event)=>show(((event as CustomEvent).detail?.source as FeedbackSource)||defaultSource);window.addEventListener(EVENT,listen);return()=>window.removeEventListener(EVENT,listen);},[show,defaultSource]);
 useEffect(()=>{const d=dialog.current;if(!d)return;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close();},[open]);
 const close=()=>{if(busy)return;setOpen(false);if(done){setText('');setRating(0);setReply(false);setConsent(false);setKind('idea');setTopic('listings');}requestAnimationFrame(()=>opener.current?.focus?.());};
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setError('');
  if(text.trim().length<FEEDBACK_LIMITS.messageMin){setError('Mesajınız en az 10 karakter olmalıdır.');message.current?.focus();return;}
  setBusy(true);
  try{
   const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,topic,message:text,rating:rating||null,reply,email:reply?email:'',consent:reply&&consent,website,source,path:window.location.pathname,locale,viewport:viewport(),fillMs:Math.round(performance.now()-openedAt.current)})});
   const data=await response.json().catch(()=>({})) as {error?:string};
   if(!response.ok)throw Error(data.error||'Geri bildiriminiz gönderilemedi. Lütfen tekrar deneyin.');
   setDone(true);
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 const hidden=!launcher||path?.startsWith('/asistan');
 const count=text.trim().length;
 return <>
  {!hidden&&<button type="button" className="feedback-launcher" onClick={()=>show(defaultSource)} aria-haspopup="dialog" aria-label={t('Öneri / Geri bildirim')} title={t('Öneri / Geri bildirim')}><Lightbulb size={19} aria-hidden="true"/><span>{t('Öneri / Geri bildirim')}</span></button>}
  <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title" aria-describedby="feedback-intro" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current)close();}}>
   {open&&<div className="feedback-inner">
    <header className="feedback-head"><span className="feedback-icon" aria-hidden="true"><Lightbulb size={20}/></span><div><h2 id="feedback-title">{t('Öneri ve geri bildirim')}</h2><p id="feedback-intro">{t('Fikirleriniz siteyi birlikte geliştirmemize yardım ediyor. Her mesajı ekibimiz okur.')}</p></div><button type="button" className="feedback-close" onClick={close} disabled={busy} aria-label={t('Kapat')}><X size={20}/></button></header>
    {done?<div className="feedback-done" role="status"><CheckCircle2 size={38} aria-hidden="true"/><h3>{t('Teşekkür ederiz!')}</h3><p>{t(reply?'Geri bildiriminiz bize ulaştı. Gerekirse verdiğiniz e-posta adresinden size dönüş yapacağız.':'Geri bildiriminiz bize ulaştı. Siteyi geliştirirken dikkate alacağız.')}</p><button type="button" className="btn btn-primary" onClick={close} autoFocus>{t('Kapat')}</button></div>:
    <form className="feedback-form" onSubmit={submit} noValidate>
     <fieldset className="feedback-kinds"><legend>{t('Ne tür bir geri bildirim?')}</legend><div>{(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map(value=><label key={value} className={kind===value?'is-selected':''}><input type="radio" name="feedback-kind" value={value} checked={kind===value} onChange={()=>setKind(value)} disabled={busy}/><span>{t(FEEDBACK_KINDS[value])}</span></label>)}</div></fieldset>
     <label className="feedback-field">{t('Konu')}<select value={topic} onChange={event=>setTopic(event.target.value as FeedbackTopic)} disabled={busy}>{(Object.keys(FEEDBACK_TOPICS) as FeedbackTopic[]).map(value=><option key={value} value={value}>{t(FEEDBACK_TOPICS[value])}</option>)}</select></label>
     <label className="feedback-field" htmlFor="feedback-message">{t('Mesajınız')}</label>
     <textarea id="feedback-message" ref={message} rows={5} minLength={FEEDBACK_LIMITS.messageMin} maxLength={FEEDBACK_LIMITS.messageMax} required value={text} disabled={busy} onChange={event=>setText(event.target.value)} aria-describedby="feedback-count" placeholder={t('Neyi beğendiniz, neyi değiştirelim? Hata bildiriyorsanız ne yaptığınızı ve ne olduğunu yazın. Şifre veya banka bilgisi yazmayın.')}/>
     <small id="feedback-count" className="feedback-count">{count} / {FEEDBACK_LIMITS.messageMax} · {t('En az 10 karakter')}</small>
     <fieldset className="feedback-rating"><legend>{t('Siteden ne kadar memnunsunuz?')} <small>({t('isteğe bağlı')})</small></legend><div>{[1,2,3,4,5].map(value=><label key={value} className={rating===value?'is-selected':''}><input type="radio" name="feedback-rating" value={value} checked={rating===value} onChange={()=>setRating(value)} disabled={busy}/><span aria-hidden="true">{value}</span><span className="sr-only">{t('{n} / 5').replace('{n}',String(value))}</span></label>)}{rating>0&&<button type="button" className="feedback-clear" onClick={()=>setRating(0)} disabled={busy}>{t('Puanı kaldır')}</button>}</div><p className="feedback-scale" aria-hidden="true"><span>{t('Hiç memnun değilim')}</span><span>{t('Çok memnunum')}</span></p></fieldset>
     <label className="feedback-check"><input type="checkbox" checked={reply} onChange={event=>setReply(event.target.checked)} disabled={busy}/><span>{t('Size dönüş yapmamızı ister misiniz?')}</span></label>
     {reply&&<div className="feedback-reply">
      <label className="feedback-field">{t('E-posta adresiniz')}<input type="email" inputMode="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} readOnly={Boolean(account)} disabled={busy} maxLength={FEEDBACK_LIMITS.emailMax} required aria-describedby={account?'feedback-email-note':undefined}/></label>
      {account&&<small id="feedback-email-note" className="feedback-count">{t('Hesabınızdaki e-posta adresi kullanılır.')}</small>}
      <label className="feedback-check"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy} required/><span>{t('E-posta adresimin yalnızca bu geri bildirime yanıt vermek için kullanılmasını kabul ediyorum.')}</span></label>
     </div>}
     <div className="feedback-trap" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label></div>
     <p className="feedback-privacy">{t('Mesajınızla birlikte bulunduğunuz sayfa, dil, ekran türü ve tarayıcı türü kaydedilir; IP adresiniz saklanmaz.')} <Link href="/gizlilik-politikasi" target="_blank" rel="noopener noreferrer">{t('Gizlilik politikası')}</Link></p>
     <div aria-live="assertive">{error&&<p className="form-error" role="alert">{t(error)}</p>}</div>
     <div className="feedback-actions"><button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>{t('Vazgeç')}</button><button type="submit" className="btn btn-primary" disabled={busy}>{t(busy?'Gönderiliyor…':'Gönder')}</button></div>
    </form>}
   </div>}
  </dialog>
 </>;
}

// Footer link "Öneri ve fikirleriniz" (main site and the Hizmetler sub-site).
export function FeedbackLink({className,source='footer'}:{className?:string;source?:FeedbackSource}){
 const {t}=useLocale();
 return <button type="button" className={className||'footer-link-button'} onClick={()=>openFeedback(source)} aria-haspopup="dialog">{t('Öneri ve fikirleriniz')}</button>;
}

// Hesabım card for agents, companies and service firm owners.
export function FeedbackCard(){
 const {t}=useLocale();
 return <aside className="feedback-card" aria-labelledby="feedback-card-title"><span className="feedback-icon" aria-hidden="true"><Lightbulb size={20}/></span><div><h3 id="feedback-card-title">{t('Fikriniz var mı?')}</h3><p>{t('Panelde eksik bulduğunuz bir özellik, işinizi kolaylaştıracak bir fikir veya karşılaştığınız bir sorun varsa bize yazın.')}</p></div><button type="button" className="btn btn-secondary btn-sm" onClick={()=>openFeedback('panel')} aria-haspopup="dialog">{t('Öneri gönder')}</button></aside>;
}
