'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {BadgeCheck,Smartphone} from 'lucide-react';
import {useLocale} from '@/lib/i18n';

type State={available:boolean;phone:string|null;verified:boolean};
async function post<T>(url:string,payload:Record<string,unknown>){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({})) as T&{error?:string;retryAfter?:number};if(!r.ok)throw Object.assign(Error(d.error||'İşlem tamamlanamadı.'),{retryAfter:d.retryAfter});return d;}

// "Telefon doğrulandı" mark for the account page and a small inline badge for others to reuse.
export function PhoneVerifiedMark(){const {t}=useLocale();return <span className="phone-verified-mark"><BadgeCheck size={15}/>{t('Telefon doğrulandı')}</span>;}

// Optional SMS verification of the account phone. Hidden behind a notice until an SMS provider is configured.
export function PhoneVerification(){
 const {t}=useLocale();
 const [state,setState]=useState<State|null>(null),[phone,setPhone]=useState(''),[sentTo,setSentTo]=useState(''),[wait,setWait]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(()=>fetch('/api/account/phone',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const d=await r.json() as State;setState(d);setPhone(d.phone||'');}).catch(()=>setState(null)),[]);
 useEffect(()=>{void load();const changed=()=>void load();window.addEventListener('salesorrent:profile-changed',changed);return()=>window.removeEventListener('salesorrent:profile-changed',changed);},[load]);
 useEffect(()=>{if(wait<=0)return;const timer=window.setTimeout(()=>setWait(w=>w-1),1000);return()=>clearTimeout(timer);},[wait]);
 async function send(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy||wait>0)return;setBusy(true);setError('');setNotice('');try{const d=await post<{phone:string;resendAfter:number}>('/api/account/phone/send-code',{phone});setSentTo(d.phone);setWait(d.resendAfter||60);setNotice('Kod gönderildi. SMS ile gelen 6 haneli kodu girin.');}catch(cause){const c=cause as Error&{retryAfter?:number};if(c.retryAfter)setWait(c.retryAfter);setError(c.message);}finally{setBusy(false);}}
 async function verify(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{await post('/api/account/phone/verify',{code:String(new FormData(e.currentTarget).get('code')||'')});setSentTo('');setNotice('Telefon numaranız doğrulandı.');window.dispatchEvent(new Event('salesorrent:profile-changed'));await load();}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}}
 if(!state)return null;
 return <section className="phone-verification"><h4><Smartphone size={18}/>{t('Telefon doğrulaması')}</h4>
  {!state.available?<p>{t('Telefon doğrulaması henüz kullanılamıyor.')}</p>
  :state.verified&&!sentTo?<><p><PhoneVerifiedMark/> <strong dir="ltr">{state.phone}</strong></p><p>{t('Numaranızı değiştirirseniz yeni numarayı yeniden doğrulamanız gerekir.')}</p></>
  :<><p>{t('Numaranızı SMS ile doğrulayabilirsiniz. Doğrulama isteğe bağlıdır.')}</p>
   <form className="phone-verification-form" onSubmit={send}><label>{t('Telefon numarası')}<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+90 555 111 22 33" required maxLength={32} disabled={busy}/></label><button className="outline-button" disabled={busy||wait>0}>{wait>0?`${t('Yeniden gönder')} (${wait})`:t(sentTo?'Yeniden gönder':'Kod gönder')}</button></form>
   {sentTo&&<form className="phone-verification-form" onSubmit={verify}><label>{t('Doğrulama kodu')}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/></label><button className="primary-button" disabled={busy}>{t('Doğrula')}</button></form>}</>}
  {notice&&<p role="status">{t(notice)}</p>}{error&&<p className="form-error" role="alert">{t(error)}</p>}
 </section>;
}
