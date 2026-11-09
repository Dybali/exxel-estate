'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from './SafeLink';
import {Lightbulb,Mail,Reply,Save,Search,Send,ArrowRight} from 'lucide-react';
import {useLocale} from '@/lib/i18n';
import {apiJson} from '@/lib/api-client';
import {FEEDBACK_KINDS,FEEDBACK_LIMITS,FEEDBACK_ROLES,FEEDBACK_STATUSES,FEEDBACK_TOPICS,type Feedback,type FeedbackKind,type FeedbackStatus,type FeedbackTopic} from '@/lib/feedback';

type List={items:Feedback[];total:number;page:number;pageSize:number;newCount:number;emailProvider?:string|null;error?:string};
type Summary={total:number;rated:number;averageRating:number|null;byKind:Record<FeedbackKind,number>;topTopics:{topic:FeedbackTopic;count:number}[];newCount:number};
const STATUS_BADGE:Record<FeedbackStatus,string>={new:'pending',reviewing:'neutral',planned:'neutral',done:'good',declined:'bad'};
const SOURCES:Record<string,string>={widget:'Sabit düğme',footer:'Alt bilgi bağlantısı',panel:'Hesabım paneli',services:'Hizmetler'};
const VIEWPORTS:Record<string,string>={mobile:'Mobil',tablet:'Tablet',desktop:'Masaüstü',unknown:'Bilinmiyor'};

// Admin view "Öneriler": feedback from the site, filtered and paginated on the server. Each item shows the
// captured context, a status workflow with an internal note (both audited) and an e-mail reply when the
// sender left an address.
export function AdminFeedback(){
 const {t,locale}=useLocale();
 const [filters,setFilters]=useState({status:'new',kind:'',topic:'',role:'',hasEmail:'',q:''}),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const [list,setList]=useState<List|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 const [drafts,setDrafts]=useState<Record<string,{status:FeedbackStatus;note:string}>>({});
 const [replyFor,setReplyFor]=useState(''),[replyText,setReplyText]=useState(''),[replyError,setReplyError]=useState('');
 const load=useCallback(async()=>{
  try{const params=new URLSearchParams({...filters,page:String(page)});const response=await fetch('/api/admin/feedback?'+params,{cache:'no-store'});const data=await apiJson<List>(response);
   if(response.status===401||response.status===403){location.assign('/yonetim/giris?reason=session');return;}
   if(!response.ok||!data.items)throw Error(data.error||'Geri bildirimler yüklenemedi.');setList(data);setError('');}
  catch(cause){setError((cause as Error).message);}
 },[filters,page]);
 useEffect(()=>{void load();},[load]);
 const set=(key:keyof typeof filters,value:string)=>{setFilters(old=>({...old,[key]:value}));setPage(1);};
 const draft=(item:Feedback)=>drafts[item.id]||{status:item.status,note:item.adminNote};
 async function save(item:Feedback){
  const d=draft(item);setBusy(item.id);setError('');setNotice('');
  try{const response=await fetch('/api/admin/feedback',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,status:d.status,note:d.note})});const data=await apiJson<{error?:string}>(response);
   if(!response.ok)throw Error(data.error||'İşlem tamamlanamadı.');setDrafts(old=>{const next={...old};delete next[item.id];return next;});setNotice('Değişiklikler kaydedildi.');await load();}
  catch(cause){setError((cause as Error).message);}finally{setBusy('');}
 }
 async function sendReply(item:Feedback){
  setBusy(item.id);setReplyError('');setNotice('');
  try{const response=await fetch('/api/admin/feedback/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,text:replyText})});const data=await apiJson<{error?:string}>(response);
   if(!response.ok)throw Error(data.error||'Yanıt gönderilemedi. E-posta ayarlarını kontrol edin veya e-posta programınızdan yanıtlayın.');setReplyFor('');setReplyText('');setNotice('Yanıt e-postayla gönderildi.');await load();}
  catch(cause){setReplyError((cause as Error).message);}finally{setBusy('');}
 }
 const date=(value:string)=>value?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
 const pages=list?Math.max(1,Math.ceil(list.total/list.pageSize)):1;
 const select=(key:keyof typeof filters,label:string,options:Record<string,string>,all='Tümü')=><label>{t(label)}<select value={filters[key]} onChange={event=>set(key,event.target.value)}><option value="">{t(all)}</option>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{t(text)}</option>)}</select></label>;
 return <section className="admin-feedback">
  <div className="admin-filterbar"><div className="admin-tabs" role="group" aria-label={t('Durum')}>{([['','Tümü'],...Object.entries(FEEDBACK_STATUSES)] as [string,string][]).map(([id,label])=><button type="button" key={id||'all'} aria-pressed={filters.status===id} onClick={()=>set('status',id)}>{t(label)}{id==='new'&&list?` · ${list.newCount}`:''}</button>)}</div></div>
  <form className="admin-feedback-filters" role="search" onSubmit={event=>{event.preventDefault();set('q',query.trim());}}>
   {select('kind','Tür',FEEDBACK_KINDS)}{select('topic','Konu',FEEDBACK_TOPICS)}{select('role','Gönderen',FEEDBACK_ROLES)}{select('hasEmail','E-posta',{'1':'E-posta adresi var','0':'E-posta adresi yok'})}
   <label>{t('Ara')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Mesaj, e-posta veya sayfa')}/></label>
   <button type="submit" className="admin-secondary"><Search size={15}/>{t('Ara')}</button>
  </form>
  {error&&<div className="admin-notice error" role="alert">{t(error)}</div>}
  {notice&&<div className="admin-notice success" role="status">{t(notice)}</div>}
  {list&&!list.emailProvider&&<div className="admin-notice">{t('E-posta gönderimi yapılandırılmamış. Yanıtı e-posta programınızdan gönderin.')}</div>}
  {!list&&!error&&<div className="admin-card admin-loading">{t('Geri bildirimler yükleniyor…')}</div>}
  {list&&!list.items.length&&<div className="admin-card admin-empty"><Lightbulb size={28}/><strong>{t('Bu filtrede geri bildirim yok.')}</strong></div>}
  {list?.items.map(item=>{const d=draft(item);const dirty=d.status!==item.status||d.note!==item.adminNote;return <article key={item.id} className="admin-card admin-feedback-item">
   <header><div><span className={'admin-badge '+STATUS_BADGE[item.status]}>{t(FEEDBACK_STATUSES[item.status])}</span><strong>{t(FEEDBACK_KINDS[item.kind])}</strong><span className="admin-muted">· {t(FEEDBACK_TOPICS[item.topic])}</span>{item.rating&&<span className="admin-feedback-stars" aria-label={t('Memnuniyet')+': '+item.rating+'/5'}>{'★'.repeat(item.rating)}<span className="admin-muted">{'☆'.repeat(5-item.rating)}</span></span>}</div><span className="admin-muted">{date(item.createdAt)}</span></header>
   <p className="admin-feedback-text">{item.message}</p>
   <dl className="admin-feedback-context">
    <div><dt>{t('Gönderen')}</dt><dd>{t(FEEDBACK_ROLES[item.role])}{item.userId&&<> · <Link href={'/yonetim?view=messages&recipient='+item.userId}>{t('Mesaj yaz')}</Link></>}</dd></div>
    <div><dt>{t('E-posta')}</dt><dd>{item.email?<a href={'mailto:'+item.email}>{item.email}</a>:'—'}</dd></div>
    <div><dt>{t('Sayfa')}</dt><dd><a href={item.pagePath} target="_blank" rel="noopener noreferrer" dir="ltr">{item.pagePath}</a></dd></div>
    <div><dt>{t('Dil')}</dt><dd>{item.locale.toUpperCase()}</dd></div>
    <div><dt>{t('Ekran')}</dt><dd>{t(VIEWPORTS[item.viewport]||'Bilinmiyor')}</dd></div>
    <div><dt>{t('Tarayıcı')}</dt><dd dir="ltr">{item.userAgent}</dd></div>
    <div><dt>{t('Kaynak')}</dt><dd>{t(SOURCES[item.source]||'Sabit düğme')}</dd></div>
    {item.userId&&<div><dt>{t('Üye no.')}</dt><dd dir="ltr"><code>{item.userId}</code></dd></div>}
    <div><dt>{t('Son güncelleme')}</dt><dd>{date(item.updatedAt)}</dd></div>
   </dl>
   {!!item.replies.length&&<div className="admin-contact-replies"><strong>{t('Gönderilen yanıtlar')}</strong>{item.replies.map(reply=><div key={reply.id} className="admin-contact-reply"><p className="admin-muted">{date(reply.createdAt)}{reply.adminName?` · ${reply.adminName}`:''}</p><p className="admin-contact-text">{reply.body}</p></div>)}</div>}
   <form className="admin-feedback-manage" onSubmit={event=>{event.preventDefault();void save(item);}}>
    <label>{t('Durum')}<select value={d.status} onChange={event=>setDrafts(old=>({...old,[item.id]:{...d,status:event.target.value as FeedbackStatus}}))} disabled={busy===item.id}>{Object.entries(FEEDBACK_STATUSES).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label>{t('İç not (yalnızca yöneticiler görür)')}<textarea rows={2} maxLength={FEEDBACK_LIMITS.noteMax} value={d.note} onChange={event=>setDrafts(old=>({...old,[item.id]:{...d,note:event.target.value}}))} disabled={busy===item.id}/></label>
    <div className="admin-contact-actions">
     <button type="submit" className="admin-primary" disabled={!dirty||busy===item.id}><Save size={15}/>{t('Kaydet')}</button>
     {item.email&&replyFor!==item.id&&<button type="button" className="btn btn-primary btn-sm" disabled={!list.emailProvider||busy===item.id} onClick={()=>{setReplyFor(item.id);setReplyText('');setReplyError('');setNotice('');}}><Reply size={15}/>{t('Yanıtla')}</button>}
     {item.email&&<a className="admin-secondary" href={`mailto:${item.email}?subject=${encodeURIComponent('estatemarket24: '+t(FEEDBACK_KINDS[item.kind]))}`}><Mail size={15}/>{t('E-postayla yanıtla')}</a>}
    </div>
   </form>
   {replyFor===item.id&&<form className="admin-contact-reply-form" onSubmit={event=>{event.preventDefault();void sendReply(item);}}>
    <label htmlFor={'feedback-reply-'+item.id}>{t('Yanıtınız')}</label>
    <textarea id={'feedback-reply-'+item.id} rows={6} maxLength={FEEDBACK_LIMITS.replyMax} value={replyText} onChange={event=>setReplyText(event.target.value)} autoFocus/>
    <p className="admin-muted">{t('Yanıt e-postayla gönderilir, geri bildirim altına eklenir ve işlem geçmişine yazılır.')}</p>
    {replyError&&<div className="admin-notice error" role="alert">{t(replyError)}</div>}
    <div className="admin-contact-actions"><button type="submit" className="btn btn-primary btn-sm" disabled={busy===item.id||replyText.trim().length<FEEDBACK_LIMITS.replyMin}><Send size={15}/>{t(busy===item.id?'Gönderiliyor…':'Yanıtı gönder')}</button><button type="button" className="btn btn-secondary btn-sm" disabled={busy===item.id} onClick={()=>setReplyFor('')}>{t('Vazgeç')}</button></div>
   </form>}
  </article>;})}
  {list&&list.total>list.pageSize&&<div className="admin-pagination"><span>{t('Sayfa {page} / {pages} · {total} kayıt').replace('{page}',String(list.page)).replace('{pages}',String(pages)).replace('{total}',String(list.total))}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{t('Önceki')}</button><button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>{t('Sonraki')}</button></div></div>}
 </section>;
}

// Overview card: last 30 days of feedback.
export function AdminFeedbackSummary(){
 const {t,locale}=useLocale(),[summary,setSummary]=useState<Summary|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/admin/feedback?summary=1',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json() as Promise<{summary:Summary}>:Promise.reject()).then(d=>setSummary(d.summary)).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[]);
 if(failed)return null;
 const nf=new Intl.NumberFormat(locale==='tr'?'tr-TR':locale,{maximumFractionDigits:1});
 return <section className="admin-feedback-summary" aria-label={t('Öneriler · son 30 gün')}>
  <article className="admin-card"><h3>{t('Ortalama memnuniyet · son 30 gün')}</h3><strong>{summary?.averageRating!=null?`${nf.format(summary.averageRating)} / 5`:'—'}</strong><p className="admin-muted">{summary?t('{n} puanlı geri bildirim').replace('{n}',nf.format(summary.rated)):t('Yükleniyor...')}</p></article>
  <article className="admin-card"><h3>{t('Türlere göre · son 30 gün')}</h3>{summary&&<ul>{(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map(kind=><li key={kind}><span>{t(FEEDBACK_KINDS[kind])}</span><b>{nf.format(summary.byKind[kind]||0)}</b></li>)}</ul>}</article>
  <article className="admin-card"><h3>{t('En sık konular')}</h3>{summary&&(summary.topTopics.length?<ul>{summary.topTopics.map(row=><li key={row.topic}><span>{t(FEEDBACK_TOPICS[row.topic])}</span><b>{nf.format(row.count)}</b></li>)}</ul>:<p className="admin-muted">{t('Bu dönemde kayıt yok.')}</p>)}<Link href="/yonetim?view=feedback">{t('Önerileri aç')} <ArrowRight size={14}/></Link></article>
 </section>;
}
