"use client";
import {useEffect,useState} from 'react';
import {ShieldCheck,LogOut} from 'lucide-react';
import {useLocale} from '@/lib/i18n';
export function AccountSecurity(){
 const {t}=useLocale(),[count,setCount]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const refresh=()=>fetch('/api/account-security',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();setCount(data.activeSessions);}).catch(()=>setError('Oturum bilgileri yüklenemedi.'));
 useEffect(()=>{void refresh();},[]);
 async function act(action:string){if(busy)return;setBusy(true);setError('');setSaved(false);try{const r=await fetch('/api/account-security',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});if(!r.ok)throw Error('İşlem tamamlanamadı.');if(action==='logout_all'){location.assign('/giris');return;}await refresh();setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="account-security"><h3><ShieldCheck size={20}/>{t('Hesap güvenliği')}</h3><p>{t('Etkin oturum sayısı')}: <strong>{count??'—'}</strong></p><p>{t('Diğer cihazlardaki oturumlarınızı kapatabilirsiniz. Bu cihazda açık kalırsınız.')}</p><div><button className="outline-button" type="button" disabled={busy||count===null||count<2} onClick={()=>act('logout_others')}><LogOut size={16}/>{t('Diğer oturumları kapat')}</button><button className="outline-button" type="button" disabled={busy} onClick={()=>act('logout_all')}>{t('Tüm cihazlardan çıkış yap')}</button></div>{saved&&<p role="status">{t('Diğer oturumlar kapatıldı.')}</p>}{error&&<p className="form-error" role="alert">{t(error)}</p>}</section>;
}
