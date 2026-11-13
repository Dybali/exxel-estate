'use client';
import {useCallback,useEffect,useState} from 'react';
import {BadgeCheck,CircleAlert,CircleCheck,ExternalLink,ShieldCheck,Undo2} from 'lucide-react';
import {apiJson} from '@/lib/api-client';import {useLocale} from '@/lib/i18n';
import {TTBS_QUERY_URL} from '@/lib/office-check';

// Automatic document check of one applicant (lib/office-check.ts) with the one-click TTBS lookup.
type Check={id:string;ok:boolean;detail?:string};
type Data={score:number;decision:string;checks:Check[];extracted:Record<string,string|boolean>;validUntil:string|null;checkedAt:string;ttbsCheckedAt:string|null;current:boolean;state:string;entered:{documentNumber:string;company:string;taxNumber:string}};
const LABELS:Record<string,string>={unique_number:'Belge numarası başka hesapta kullanılmıyor',unique_file:'Aynı dosya başka hesapta yüklenmemiş',tax_number_valid:'Vergi / TC kimlik numarası geçerli',document_read:'Belge okunabildi',document_type:'Belge bir Taşınmaz Ticareti Yetki Belgesi',number_match:'Belge numarası başvuruyla aynı',name_match:'İşletme adı başvuruyla uyuşuyor',valid_until:'Belgenin süresi dolmamış',tax_number_match:'Belgedeki vergi numarası başvuruyla aynı',no_editing_signs:'Belgede değiştirilme izi yok'};
export function AdminOfficeCheck({userId,onChanged}:{userId:string;onChanged:()=>void}){
 const {t}=useLocale(),[data,setData]=useState<Data|null|undefined>(undefined),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const load=useCallback(()=>{fetch('/api/admin/office-checks?userId='+encodeURIComponent(userId),{cache:'no-store'}).then(r=>apiJson<{check:Data|null}>(r)).then(d=>setData(d.check)).catch(()=>setData(null));},[userId]);
 useEffect(()=>{load();},[load]);
 async function act(payload:Record<string,unknown>){setBusy(true);setError('');try{const r=await fetch('/api/admin/agent-verifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:userId,...payload})});const d=await apiJson<{error?:string}>(r);if(!r.ok)throw Error(d.error||'İşlem tamamlanamadı.');load();onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(data===undefined)return null;
 if(!data)return <section className="admin-office-check"><p>{t('Bu başvuru için otomatik kontrol yapılmamış (sistemden önce gönderilmiş belge).')}</p><a className="admin-secondary" href={TTBS_QUERY_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{t("TTBS'de sorgula")}</a></section>;
 const extracted=data.extracted;
 return <section className="admin-office-check">
  <header><ShieldCheck size={18}/><strong>{t('Otomatik belge kontrolü')}</strong><span className={'admin-badge '+(data.score>=100?'good':data.score>=70?'pending':'neutral')}>{data.score}/100</span>
   {data.decision==='auto_approved'&&<span className="admin-badge good">{t('Otomatik onaylandı')}</span>}
   {data.ttbsCheckedAt?<span className="admin-badge good"><BadgeCheck size={13}/> {t('TTBS doğrulandı')}</span>:data.state==='approved'&&<span className="admin-badge pending">{t('TTBS kontrolü bekliyor')}</span>}</header>
  <ul>{data.checks.map(check=><li key={check.id} className={check.ok?'ok':'fail'}>{check.ok?<CircleCheck size={15}/>:<CircleAlert size={15}/>}<span>{t(LABELS[check.id]||check.id)}{check.detail?<small> · {check.detail}</small>:null}</span></li>)}</ul>
  <dl>
   <div><dt>{t('Belgedeki işletme adı')}</dt><dd>{String(extracted.business_name||'—')}</dd></div>
   <div><dt>{t('Belge numarası')}</dt><dd>{String(extracted.document_number||'—')} <small>({t('başvuru')}: {data.entered.documentNumber})</small></dd></div>
   <div><dt>{t('Geçerlilik')}</dt><dd>{data.validUntil||'—'}</dd></div>
   <div><dt>{t('İl')}</dt><dd>{String(extracted.city||'—')}</dd></div>
   <div><dt>{t('Vergi no')}</dt><dd>{String(extracted.tax_number||'—')} <small>({t('başvuru')}: {data.entered.taxNumber})</small></dd></div>
   {extracted.barcode?<div><dt>{t('e-Devlet barkodu')}</dt><dd>{String(extracted.barcode)}</dd></div>:null}
   {extracted.notes?<div><dt>{t('Not')}</dt><dd>{String(extracted.notes)}</dd></div>:null}
  </dl>
  <div className="admin-office-check-actions">
   <a className="admin-secondary" href={TTBS_QUERY_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{t("TTBS'de sorgula")}</a>
   {data.state==='approved'&&!data.ttbsCheckedAt&&<button type="button" className="admin-primary" disabled={busy} onClick={()=>void act({action:'ttbs_confirmed'})}><BadgeCheck size={15}/>{t('TTBS doğrulandı')}</button>}
  </div>
  {data.state==='approved'&&<div className="admin-office-check-revoke"><input value={note} onChange={e=>setNote(e.target.value)} placeholder={t('Onayı geri alma nedeni (ofise gösterilir)')} maxLength={1000}/><button type="button" className="admin-secondary" disabled={busy||note.trim().length<5} onClick={()=>void act({action:'revoke',note})}><Undo2 size={15}/>{t('Onayı geri al')}</button></div>}
  <p className="admin-office-check-note">{t('TTBS sayfasında belge numarasını ve işletme adını girip sonucun bu bilgilerle aynı olduğunu kontrol edin.')}</p>
  {error&&<p className="form-error" role="alert">{t(error)}</p>}
 </section>;
}
