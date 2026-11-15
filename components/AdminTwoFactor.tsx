'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {KeyRound,ShieldCheck,ShieldOff,Copy,RefreshCw} from 'lucide-react';
import Link from './SafeLink';
import {useLocale} from '@/lib/i18n';

type Status={available:boolean;enabled:boolean;enabledAt?:string|null;recoveryCodesLeft:number;pending?:boolean};
type Enrolment={secret:string;uri:string};
async function call<T>(payload:Record<string,unknown>){const r=await fetch('/api/admin/two-factor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw Error(d.error||'İşlem tamamlanamadı.');return d;}
const grouped=(secret:string)=>secret.replace(/(.{4})/g,'$1 ').trim();

// Administrator security settings: enrol, confirm and disable TOTP two-factor login.
export function AdminTwoFactor(){
 const {t,locale}=useLocale();
 const [status,setStatus]=useState<Status|null>(null),[enrolment,setEnrolment]=useState<Enrolment|null>(null),[codes,setCodes]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch('/api/admin/two-factor',{cache:'no-store'});const d=await r.json() as Status&{error?:string};if(!r.ok)throw Error(d.error||'İşlem tamamlanamadı.');setStatus(d);}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{void load();},[load]);
 async function run(action:string,code='',form?:HTMLFormElement){if(busy)return;setBusy(true);setError('');setNotice('');try{
  if(action==='start'){setCodes([]);setEnrolment(await call<Enrolment>({action}));}
  if(action==='confirm'){const d=await call<{recoveryCodes:string[]}>({action,code});setEnrolment(null);setCodes(d.recoveryCodes);setNotice('İki adımlı doğrulama etkinleştirildi.');}
  if(action==='disable'){await call({action,code});setCodes([]);setNotice('İki adımlı doğrulama kapatıldı.');}
  if(action==='recovery_codes'){const d=await call<{recoveryCodes:string[]}>({action,code});setCodes(d.recoveryCodes);setNotice('Yeni kurtarma kodları oluşturuldu. Eski kodlar artık geçersiz.');}
  form?.reset();await load();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const codeForm=(action:string,label:string,danger=false)=><form className="security-code-form" onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();void run(action,String(new FormData(e.currentTarget).get('code')||''),e.currentTarget);}}><label>{t('Doğrulama uygulamasındaki kod')}<input name="code" required minLength={6} maxLength={20} autoComplete="one-time-code" disabled={busy}/></label><button className={danger?'admin-danger':'admin-secondary'} disabled={busy}>{t(label)}</button></form>;
 const copy=(text:string)=>{void navigator.clipboard?.writeText(text).then(()=>setNotice('Panoya kopyalandı.')).catch(()=>{});};
 return <main className="admin-page security-settings"><div className="admin-page-heading"><div><span className="admin-kicker">{t('GÜVENLİK')}</span><h1>{t('İki adımlı doğrulama')}</h1><p>{t('Yönetici girişinde şifrenize ek olarak Google Authenticator veya Microsoft Authenticator gibi bir uygulamadaki 6 haneli kod istenir.')}</p></div></div>
 {error&&<div className="admin-notice error" role="alert">{t(error)}</div>}{notice&&<div className="admin-notice" role="status">{t(notice)}</div>}
 {status?.available&&status.pending&&!status.enabled&&<div className="admin-notice" role="status">{t('Yönetim paneline erişmek için önce iki adımlı doğrulamayı kurun.')}</div>}{!status?<p className="admin-loading">{t('Yükleniyor…')}</p>:!status.available?<section className="admin-card"><h2><ShieldOff size={20}/> {t('Henüz kullanılamıyor')}</h2><p>{t('İki adımlı doğrulama için sunucuda ADMIN_TOTP_KEY gizli değeri tanımlanmalıdır. Ayrıntılar docs/security-checklist.md dosyasındadır.')}</p></section>
 :status.enabled?<section className="admin-card"><h2><ShieldCheck size={20}/> {t('İki adımlı doğrulama etkin')}</h2>{status.enabledAt&&<p>{t('Etkinleştirme tarihi')}: {new Date(status.enabledAt).toLocaleString(locale)}</p>}<p>{t('Kalan kurtarma kodu')}: <strong>{status.recoveryCodesLeft}</strong></p><p>{t('Her yeni oturumda giriş yaptıktan sonra kod istenir. Onay 12 saat veya tarayıcı kapanana kadar geçerlidir.')}</p>
  <h3><RefreshCw size={17}/> {t('Yeni kurtarma kodları')}</h3>{codeForm('recovery_codes','Yeni kurtarma kodları oluştur')}
  <h3><ShieldOff size={17}/> {t('İki adımlı doğrulamayı kapat')}</h3><p>{t('Kapatmak yönetici hesabınızın korumasını azaltır.')}</p>{codeForm('disable','Doğrulamayı kapat',true)}</section>
 :<section className="admin-card"><h2><KeyRound size={20}/> {t('İki adımlı doğrulama kapalı')}</h2>
  {!enrolment?<><p>{t('Kurulum iki dakika sürer: uygulamaya anahtarı ekleyin, ardından gösterilen kodu girin.')}</p><button className="admin-primary" disabled={busy} onClick={()=>void run('start')}>{t('Kurulumu başlat')}</button></>
  :<div className="security-enrolment"><ol><li>{t('Telefonunuzda Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamayı açın.')}</li><li>{t('Yeni hesap ekleyin ve "kurulum anahtarı gir" seçeneğiyle aşağıdaki anahtarı yazın (zaman tabanlı). Bu telefondaysanız bağlantıya dokunarak da ekleyebilirsiniz.')}</li><li>{t('Uygulamanın gösterdiği 6 haneli kodu girip kurulumu tamamlayın.')}</li></ol>
   <p className="security-secret"><code>{grouped(enrolment.secret)}</code><button type="button" className="admin-text-button" onClick={()=>copy(enrolment.secret)}><Copy size={15}/> {t('Kopyala')}</button></p><p><a href={enrolment.uri}>{t('Doğrulama uygulamasında aç')}</a></p><p className="admin-muted">{t('Bu anahtarı kimseyle paylaşmayın. Kurulum tamamlanınca bir daha gösterilmez.')}</p>
   {codeForm('confirm','Kurulumu tamamla')}</div>}</section>}
 {codes.length>0&&<section className="admin-card security-recovery"><h2>{t('Kurtarma kodlarınız')}</h2><p>{t('Bu kodları güvenli bir yere kaydedin. Telefonunuza erişemezseniz her biri bir kez giriş için kullanılabilir. Bu liste bir daha gösterilmez.')}</p><ul>{codes.map(code=><li key={code}><code>{code}</code></li>)}</ul><button type="button" className="admin-secondary" onClick={()=>copy(codes.join('\n'))}><Copy size={15}/> {t('Kopyala')}</button></section>}
 <p><Link href="/yonetim">{t('Yönetim merkezine dön')}</Link></p></main>;
}
