"use client";
import { ForwardArrow } from "@/components/DirectionalArrow";
import {useEffect,useState} from 'react';
import {ShieldCheck,LogOut} from 'lucide-react';
import {useLocale} from '@/lib/i18n';
import Link from '@/components/SafeLink';
import {PhoneVerification} from './PhoneVerification';
export function AccountSecurity({isAdmin=false}:{isAdmin?:boolean}){
 const {t}=useLocale(),[count,setCount]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const refresh=()=>fetch('/api/account-security',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const data=await r.json() as {activeSessions:number};setCount(data.activeSessions);}).catch(()=>setError(t('Oturum bilgileri yüklenemedi.')));
 useEffect(()=>{void refresh();},[]);
 async function act(action:string,fields:Record<string,unknown>={}){if(busy)return;setBusy(true);setError('');setSaved(false);try{const r=await fetch('/api/account-security',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...fields})});const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||'İşlem tamamlanamadı.');if(action==='logout_all'||action==='change_password'){location.assign('/giris');return;}await refresh();setSaved(true);}catch(e){setError(t((e as Error).message));}finally{setBusy(false);}}
 return <section className="account-security"><h3><ShieldCheck size={20}/>{t('Hesap güvenliği')}</h3><p>{t('Etkin oturum sayısı')}: <strong>{count??'—'}</strong></p><p>{t('Diğer cihazlardaki oturumlarınızı kapatabilirsiniz. Bu cihazda açık kalırsınız.')}</p><div><button className="outline-button account-logout" type="button" disabled={busy||count===null||count<2} onClick={()=>act('logout_others')}><LogOut size={16}/>{t('Diğer oturumları kapat')}</button><button className="outline-button account-logout" type="button" disabled={busy} onClick={()=>act('logout_all')}>{t('Tüm cihazlardan çıkış yap')}</button></div>
 <form className="account-password-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void act('change_password',Object.fromEntries(form));}}><h4>{t('Şifrenizi değiştirin')}</h4><p>{t('Şifre değiştiğinde tüm cihazlardan çıkış yapılır.')}</p><label>{t('Mevcut şifre')}<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label><label>{t('Yeni şifre')}<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label><label>{t('Yeni şifre tekrar')}<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label><button className="primary-button" disabled={busy}>{t('Şifremi değiştir')}</button><Link href="/sifremi-unuttum">{t('Mevcut şifremi unuttum')}</Link></form>
 <PhoneVerification/>
 {isAdmin&&<p className="admin-security-link"><Link href="/yonetim/guvenlik">{t('Yönetici iki adımlı doğrulama ayarları')}<ForwardArrow/></Link></p>}
 {saved&&<p role="status">{t('Diğer oturumlar kapatıldı.')}</p>}{error&&<p className="form-error" role="alert">{t(error)}</p>}</section>;
}
