'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import Link from './SafeLink';
import {useLocale} from '@/lib/i18n';
import {parseConsent,type CookieConsent} from '@/lib/cookie-consent';
const Context=createContext<{consent:CookieConsent|null}>({consent:null});
export const useCookieConsent=()=>useContext(Context);
export function openCookiePreferences(){window.dispatchEvent(new Event('em24:cookie-settings'));}
export function CookieConsentProvider({children}:{children:React.ReactNode}){
  const {t}=useLocale();
  const [consent,setConsent]=useState<CookieConsent|null>(null),[ready,setReady]=useState(false),[open,setOpen]=useState(false),[details,setDetails]=useState(false),[analytics,setAnalytics]=useState(false),[externalMedia,setExternalMedia]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const load=(reset=false)=>{const value=parseConsent(document.cookie);setConsent(value);if(reset){setAnalytics(Boolean(value?.analytics));setExternalMedia(Boolean(value?.externalMedia));}setReady(true);if(!value)setOpen(true);};
    const show=()=>{load(true);setDetails(true);setOpen(true);},refresh=()=>load();load(true);
    window.addEventListener('em24:cookie-settings',show);window.addEventListener('focus',refresh);
    const timer=window.setInterval(refresh,60_000);
    return()=>{clearInterval(timer);window.removeEventListener('em24:cookie-settings',show);window.removeEventListener('focus',refresh);};
  },[]);
  async function save(a:boolean,e:boolean){
    setBusy(true);setError('');
    try{const response=await fetch('/api/privacy/consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analytics:a,externalMedia:e})});const data=await response.json() as {consent:CookieConsent};if(!response.ok)throw Error();setConsent(data.consent);setAnalytics(a);setExternalMedia(e);setOpen(false);setDetails(false);}
    catch{setError(t('Tercihler kaydedilemedi. Yeniden deneyin.'));}finally{setBusy(false);}
  }
  return <Context.Provider value={{consent}}>{children}{ready&&open&&<section className="cookie-panel" aria-label={t('Çerez tercihleri')}>
    <div className="cookie-heading"><div><span>ESTATEMARKET24</span><h2>{t('Gizliliğiniz, sizin seçiminiz.')}</h2></div>{consent&&<button type="button" onClick={()=>setOpen(false)} aria-label={t('Kapat')}>×</button>}</div>
    <p>{t('Zorunlu çerezler oturum ve güvenlik için kullanılır. İlan görüntüleme ölçümü ve gömülü videolar yalnızca izninizle etkinleşir.')}{' '}<Link href="/cerez-politikasi">{t('Çerez politikası')}</Link></p>
    {details&&<div className="cookie-options"><label><input type="checkbox" checked disabled/ ><span><strong>{t('Zorunlu')}</strong><small>{t('Oturum, güvenlik ve bu tercihlerin hatırlanması. Her zaman etkin.')}</small></span></label><label><input type="checkbox" checked={analytics} onChange={e=>setAnalytics(e.target.checked)} disabled={busy}/><span><strong>{t('İstatistik')}</strong><small>{t('İlan görüntülemelerinin ölçülmesi.')}</small></span></label><label><input type="checkbox" checked={externalMedia} onChange={e=>setExternalMedia(e.target.checked)} disabled={busy}/><span><strong>{t('Harici videolar')}</strong><small>{t('YouTube ve Vimeo videoları sağlayıcılarına veri iletebilir.')}</small></span></label></div>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="cookie-actions"><button type="button" disabled={busy} onClick={()=>void save(false,false)}>{t('Yalnızca zorunlu')}</button><button type="button" disabled={busy} onClick={()=>void save(true,true)}>{t('Tümünü kabul et')}</button>{details?<button type="button" disabled={busy} onClick={()=>void save(analytics,externalMedia)}>{t('Seçimlerimi kaydet')}</button>:<button type="button" onClick={()=>setDetails(true)}>{t('Tercihleri düzenle')}</button>}</div>
  </section>}</Context.Provider>;
}
