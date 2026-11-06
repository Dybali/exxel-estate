'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from './SafeLink';
import {useLocale} from '@/lib/i18n';
import {apiJson} from '@/lib/api-client';
import {formatPrice} from '@/lib/listings';
import {photoFingerprint} from '@/lib/photo-optimize';
import type {SuspiciousListing} from '@/lib/listing-risk-server';
import {RiskReasonList,RiskScore} from './RiskReasons';
import {ArrowRight,Check,RefreshCw,ScanSearch,ShieldAlert} from 'lucide-react';

// "Şüpheli ilanlar": open fraud/duplicate flags (lib/listing-risk.ts) with the matched listings side by side.
// Advisory only: "Sorun yok" closes the flag; "İncelemeye al" and "Yayından kaldır" are the usual moderation actions.
type Match=SuspiciousListing['matches'][number];
const STATUS:Record<string,[string,string]>={published:['Yayında','good'],pending:['Onay bekliyor','pending'],rejected:['Reddedildi','neutral'],expired:['Süresi doldu','neutral'],withdrawn:['Yayından kaldırıldı','neutral']};

function Status({value}:{value:string}){const {t}=useLocale();const [label,tone]=STATUS[value]||[value,'neutral'];return <span className={'admin-badge '+tone}>{t(label)}</span>;}
function Photos({images,title}:{images:string[];title:string}){const {t}=useLocale();return images.length?<div className="risk-photos">{images.map((src,index)=><img key={src} src={src} alt={`${title} ${t('fotoğraf {n}').replace('{n}',String(index+1))}`} loading="lazy"/>)}</div>:<div className="risk-photos empty">{t('Fotoğraf yok')}</div>;}

function MatchFacts({match}:{match:Match}){
 const {t}=useLocale(),facts:string[]=[];
 if(match.exact)facts.push(t('{n} aynı dosya').replace('{n}',String(match.exact)));
 if(match.photos)facts.push(t('{n} benzer fotoğraf').replace('{n}',String(match.photos)));
 if(match.text)facts.push(t('Metin benzerliği: %{n}').replace('{n}',String(match.text)));
 if(match.attributes)facts.push(t('Aynı konum, tür ve yakın fiyat'));
 return <p className="risk-match-facts">{match.sameOwner&&<span className="admin-badge neutral">{t('Aynı hesap')}</span>}{facts.join(' · ')}</p>;
}

function Item({item,onChanged}:{item:SuspiciousListing;onChanged:()=>void}){
 const {t,locale}=useLocale(),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[removing,setRemoving]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 const price=(value:number,currency:string)=>formatPrice(value,currency,locale==='tr'?'tr-TR':locale);
 async function run(request:()=>Promise<Response>,message:string){setBusy(true);setError('');setDone('');try{const r=await request(),d=await apiJson<{error?:string}>(r);if(!r.ok)throw Error(d.error||'İşlem şu anda tamamlanamadı.');setDone(message);setRemoving(false);setNote('');onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const post=(url:string,payload:unknown)=>()=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const clear=()=>run(post('/api/admin/risk',{action:'clear',id:item.id}),'Uyarı kapatıldı. İşlem geçmişine kaydedildi.');
 const review=()=>run(post('/api/admin',{kind:'listing',id:item.id,status:'pending'}),'İlan yayından kaldırıldı ve incelemeye alındı.');
 const reject=()=>{if(note.trim().length<5){setError('Ret nedenini en az 5 karakterle yazın.');return;}void run(post('/api/admin',{kind:'listing',id:item.id,status:'rejected',note:note.trim()}),'İlan reddedildi. Gerekçe ilan sahibine gösterilecek.');};
 const account=item.owner.createdAt?Math.max(0,Math.floor((Date.now()-Date.parse(item.owner.createdAt))/86400000)):null;
 return <article className="risk-card" aria-labelledby={'risk-'+item.id}>
  <header className="risk-head"><div><RiskScore score={item.risk.score} level={item.flag}/><Status value={item.status}/></div><small>{t('Son kontrol')}: {new Date(item.risk.checkedAt).toLocaleString(locale==='tr'?'tr-TR':locale)}</small></header>
  <RiskReasonList reasons={item.risk.reasons}/>
  <div className="risk-compare">
   <section className="risk-side current"><span className="admin-kicker">{t('BU İLAN')}</span><Photos images={item.images} title={item.title}/><h3 id={'risk-'+item.id}><Link href={'/yonetim/ilan/'+item.id}>{item.title}</Link></h3><p><strong>{price(item.price,item.currency)}</strong>{item.grossArea?` · ${item.grossArea} m²`:''}</p><p className="admin-muted">{item.district}, {item.city}</p><p className="risk-owner">{item.owner.name}<small>{item.owner.email}{account!=null&&<> · {t('{n} günlük hesap').replace('{n}',String(account))}</>}</small></p></section>
   <div className="risk-matches">{item.matches.length?item.matches.map(match=><section className="risk-side" key={match.id}><span className="admin-kicker">{t('BENZER İLAN')}</span>{match.listing?<><Photos images={match.listing.images} title={match.listing.title}/><h3><Link href={'/yonetim/ilan/'+match.id}>{match.listing.title}</Link></h3><p><strong>{price(match.listing.price,match.listing.currency)}</strong>{match.listing.grossArea?` · ${match.listing.grossArea} m²`:''} <Status value={match.listing.status}/></p><p className="admin-muted">{match.listing.district}, {match.listing.city} · {match.listing.ownerName}</p></>:<p className="admin-muted">{t('Bu ilan artık mevcut değil.')}</p>}<MatchFacts match={match}/></section>):<p className="admin-muted risk-nomatch">{t('Benzer ilan bulunmadı; uyarı ilanın kendi içeriğinden kaynaklanıyor.')}</p>}</div>
  </div>
  <footer className="risk-actions">
   <div><button className="admin-primary" type="button" disabled={busy} onClick={()=>void clear()}><Check size={16}/>{t('Sorun yok')}</button>{item.status==='published'&&<button className="admin-secondary" type="button" disabled={busy} onClick={()=>void review()}>{t('İncelemeye al')}</button>}{item.status!=='rejected'&&<button className="admin-danger" type="button" disabled={busy} aria-expanded={removing} onClick={()=>setRemoving(!removing)}>{t('Yayından kaldır')}</button>}</div>
   <div><Link className="admin-text-button" href={'/yonetim?view=messages&recipient='+item.owner.id}>{t('İlan sahibine yaz')}</Link><Link className="admin-text-button" href={'/yonetim/ilan/'+item.id}>{t('Ayrıntılı incele')} <ArrowRight size={13}/></Link></div>
  </footer>
  {removing&&<div className="risk-remove"><label>{t('Ret nedeni')}<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t('İlan sahibine gösterilecek açıklama')}/></label><button className="admin-danger" type="button" disabled={busy} onClick={reject}>{t('Reddet ve yayından kaldır')}</button></div>}
  {error&&<p className="admin-notice error" role="alert">{t(error)}</p>}{done&&<p className="admin-notice success" role="status">{t(done)}</p>}
 </article>;
}

export function AdminSuspicious(){
 const {t}=useLocale();
 const [items,setItems]=useState<SuspiciousListing[]|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[scan,setScan]=useState<{done:number;total:number;remaining:number|null;running:boolean}|null>(null);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/admin/risk',{cache:'no-store'}),d=await apiJson<{items?:SuspiciousListing[];error?:string}>(r);if(r.status===401||r.status===403){location.assign('/yonetim/giris?reason=session');return;}if(!r.ok)throw Error(d.error||'Şüpheli ilanlar şu anda alınamadı.');setItems(d.items||[]);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 // Backfill: older listings have no photo fingerprints. The server cannot decode images on Workers, so
 // this browser fingerprints at most 50 listings per run (12 photos each) and the server re-checks them.
 async function backfill(){
  setScan({done:0,total:0,remaining:null,running:true});setError('');
  try{
   const r=await fetch('/api/admin/risk?backfill=1',{cache:'no-store'}),d=await apiJson<{items?:{id:string;images:string[]}[];remaining?:number;error?:string}>(r);
   if(!r.ok)throw Error(d.error||'Şüpheli ilanlar şu anda alınamadı.');
   const queue=d.items||[];let done=0;setScan({done,total:queue.length,remaining:d.remaining??null,running:true});
   for(const listing of queue){
    const hashes:Record<string,string>={};
    for(const url of listing.images){try{const photo=await fetch(url);if(!photo.ok)continue;const hash=await photoFingerprint(await photo.blob());if(hash)hashes[url]=hash;}catch{/* a photo that cannot be read is skipped */}}
    const saved=await fetch('/api/admin/risk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'fingerprints',id:listing.id,hashes})});
    if(!saved.ok){const e=await apiJson<{error?:string}>(saved);throw Error(e.error||'İşlem şu anda tamamlanamadı.');}
    done++;setScan({done,total:queue.length,remaining:Math.max(0,(d.remaining??queue.length)-done),running:true});
   }
   setScan(s=>s&&{...s,running:false});await load();
  }catch(e){setError((e as Error).message);setScan(s=>s&&{...s,running:false});}
 }
 return <section className="risk-view" aria-busy={loading}>
  <div className="admin-section-title"><div><h2>{t('Şüpheli ilanlar')}</h2><p>{t('Aynı fotoğraflar, kopya metinler, olağan dışı fiyatlar ve dolandırıcılık ifadeleri için otomatik kontrol. Uyarılar tavsiye niteliğindedir; hiçbir ilan otomatik silinmez veya reddedilmez.')}</p></div><button className="admin-secondary" type="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>{t('Yenile')}</button></div>
  <div className="risk-scan"><ScanSearch size={18} aria-hidden/><span>{t('Eski ilanların fotoğraf parmak izi yok. Tarama bu tarayıcıda yapılır; her çalıştırmada en fazla 50 ilan işlenir.')}{scan&&<> <b role="status">{t('{done}/{total} ilan tarandı').replace('{done}',String(scan.done)).replace('{total}',String(scan.total))}{scan.remaining!=null&&<> · {t('Kalan: {n}').replace('{n}',String(scan.remaining))}</>}</b></>}</span><button className="admin-secondary" type="button" disabled={scan?.running} onClick={()=>void backfill()}>{t(scan?.running?'Taranıyor…':'Eski ilanları tara')}</button></div>
  {error&&<div className="admin-notice error" role="alert">{t(error)} <button type="button" onClick={()=>void load()}>{t('Tekrar dene')}</button></div>}
  {!items?<div className="admin-card admin-loading" role="status">{t('Şüpheli ilanlar yükleniyor…')}</div>:items.length?<div className="risk-list">{items.map(item=><Item key={item.id} item={item} onChanged={()=>void load()}/>)}</div>:<div className="admin-card admin-empty"><ShieldAlert size={28}/><strong>{t('Açık uyarı yok')}</strong><p>{t('Yeni veya düzenlenen ilanlar kaydedilirken kontrol edilir.')}</p></div>}
 </section>;
}
