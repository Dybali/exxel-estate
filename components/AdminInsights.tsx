'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from './SafeLink';
import {useLocale} from '@/lib/i18n';
import {ArrowDownRight,ArrowRight,ArrowUpRight,Minus} from 'lucide-react';
import type {AdminInsights as Insights,InsightPeriod,Metric,PendingKind,RoleKind} from '@/lib/admin-insights';

const PERIODS:[InsightPeriod,string][]=[['today','Bugün'],['7d','7 gün'],['30d','30 gün'],['90d','90 gün']];
const ROLES:Record<RoleKind|'admin',string>={individual:'Bireysel',agent:'Emlakçı',developer:'İnşaat firması',buyer:'Alıcı',admin:'Yönetici'};
const PENDING:Record<PendingKind,string>={listings:'Onay bekleyen ilanlar',suspicious:'Şüpheli ilanlar',officeDocuments:'Ofis belgeleri',companyApplications:'Şirket başvuruları',projects:'Onay bekleyen projeler',services:'Onay bekleyen hizmet firmaları',reports:'İlan bildirimleri',contact:'Yeni iletişim mesajları',feedback:'Yeni öneri ve geri bildirimler',orders:'Ödeme bekleyen siparişler'};
const SERIES:[ 'listings'|'users'|'messages',string][]=[['listings','Yeni ilanlar'],['users','Yeni üyeler'],['messages','Mesajlar']];
const intlLocale=(locale:string)=>locale==='tr'?'tr-TR':locale;

function Change({value,t,format}:{value:Metric;t:(k:string)=>string;format:(n:number)=>string}){
 if(value.change===null)return <span className="insight-change up"><ArrowUpRight size={14} aria-hidden/>{t('Yeni')}</span>;
 if(value.change===0)return <span className="insight-change"><Minus size={14} aria-hidden/>{t('Değişim yok')}</span>;
 const up=value.change>0;
 return <span className={'insight-change '+(up?'up':'down')}>{up?<ArrowUpRight size={14} aria-hidden/>:<ArrowDownRight size={14} aria-hidden/>}<bdi>{(up?'+':'−')+format(Math.abs(value.change))}%</bdi></span>;
}

// Single-series daily columns. Each chart has its own scale (the three counts differ in size), a
// native hover title per day, and an accessible summary; the full numbers are in the table below.
function DailyChart({label,peakLabel,points,format,day}:{label:string;peakLabel:string;points:{day:string;value:number}[];format:(n:number)=>string;day:(d:string)=>string}){
 const max=Math.max(1,...points.map(p=>p.value)),total=points.reduce((n,p)=>n+p.value,0),peak=points.reduce((a,b)=>b.value>a.value?b:a,points[0]);
 const W=320,H=120,gap=points.length>45?1:2,bw=(W-gap*(points.length-1))/points.length;
 return <figure className="insight-chart"><figcaption><strong>{label}</strong><span>{format(total)}</span></figcaption>
  <svg viewBox={`0 0 ${W} ${H+1}`} role="img" aria-label={`${label}: ${format(total)} · ${peakLabel} ${format(peak?.value||0)} (${peak?day(peak.day):''})`} preserveAspectRatio="none">
   <line x1="0" x2={W} y1={H/2} y2={H/2} className="insight-grid"/><line x1="0" x2={W} y1={H} y2={H} className="insight-axis"/>
   {points.map((p,i)=>{const h=p.value?Math.max(2,(p.value/max)*(H-6)):0;return <g key={p.day}><rect className="insight-hit" x={i*(bw+gap)} y="0" width={bw+gap} height={H}><title>{`${day(p.day)}: ${format(p.value)}`}</title></rect>{h>0&&<rect className="insight-bar" x={i*(bw+gap)} y={H-h} width={bw} height={h} rx={Math.min(2,bw/2)}><title>{`${day(p.day)}: ${format(p.value)}`}</title></rect>}</g>;})}
  </svg>
  <div className="insight-chart-scale" dir="ltr"><span>{day(points[0]?.day||'')}</span><span>{peakLabel} {format(max)}</span><span>{day(points[points.length-1]?.day||'')}</span></div>
 </figure>;
}

export function AdminInsights({initialData}:{initialData?:Insights}={}){
 const {t,locale}=useLocale();
 const [period,setPeriod]=useState<InsightPeriod>(initialData?.period||'7d'),[data,setData]=useState<Insights|null>(initialData||null),[loading,setLoading]=useState(!initialData),[error,setError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async(next:InsightPeriod,signal?:AbortSignal)=>{
  const id=++sequence.current;setLoading(true);setError('');
  try{const r=await fetch('/api/admin/insights?period='+next,{cache:'no-store',signal});const d=await r.json().catch(()=>({})) as Insights&{error?:string};
   if(r.status===401||r.status===403){location.assign('/yonetim/giris?reason=session');return;}
   if(!r.ok)throw Error(d.error||'Rapor verileri alınamadı.');if(id===sequence.current)setData(d);}
  catch(e){if(!signal?.aborted&&id===sequence.current)setError((e as Error).message);}
  finally{if(!signal?.aborted&&id===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{if(initialData)return;const c=new AbortController();void load(period,c.signal);return()=>c.abort();},[period,load,initialData]);
 const nf=new Intl.NumberFormat(intlLocale(locale),{maximumFractionDigits:1}),format=(n:number)=>nf.format(n);
 const money=(n:number)=>new Intl.NumberFormat(intlLocale(locale),{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n);
 const day=(d:string)=>d?new Intl.DateTimeFormat(intlLocale(locale),{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')):'';
 const previous=(m:Metric)=>t('Önceki dönem: {n}').replace('{n}',format(m.previous));
 const k=data?.kpis;
 const tile=(key:string,label:string,value:Metric|null,detail?:React.ReactNode)=><article className="insight-tile" key={key}><h3>{label}</h3>{value?<><strong>{format(value.current)}</strong><p className="insight-compare"><Change value={value} t={t} format={format}/><span>{previous(value)}</span></p></>:<><strong aria-hidden>—</strong><p className="insight-compare"><span>{t('Veri yok')}</span></p></>}{detail&&<p className="insight-detail">{detail}</p>}</article>;
 return <section className="admin-insights" aria-labelledby="admin-insights-title" aria-busy={loading}>
  <div className="insight-head"><div><span className="admin-kicker">{t('RAPORLAR')}</span><h2 id="admin-insights-title">{t('Genel bakış ve raporlar')}</h2><p>{t('Seçili dönem, hemen önceki eşit uzunluktaki dönemle karşılaştırılır. Saatler UTC; örnek ilanlar sayılmaz.')}</p></div>
   <div className="admin-tabs insight-periods" role="group" aria-label={t('Rapor dönemi')}>{PERIODS.map(([id,label])=><button type="button" key={id} aria-pressed={period===id} disabled={loading&&period===id} onClick={()=>{if(initialData)return;setPeriod(id);}}>{t(label)}</button>)}</div></div>
  {error&&<div className="admin-notice error" role="alert">{t(error)} <button type="button" onClick={()=>void load(period)}>{t('Tekrar dene')}</button></div>}
  {!data?<div className="admin-card admin-loading" role="status">{t('Rapor yükleniyor…')}</div>:k&&<>
   <div className="insight-tiles">
    {tile('users',t('Yeni üyeler'),k.users,(['individual','agent','developer','buyer'] as RoleKind[]).map(r=><span key={r}>{t(ROLES[r])} <b>{format(k.users.byRole[r].current)}</b></span>))}
    {tile('listings',t('Yeni ilanlar'),k.listings,<><span>{t('Yayında')} <b>{format(k.listings.published.current)}</b></span><span>{t('Onay bekleyen')} <b>{format(k.listings.pending.current)}</b></span></>)}
    <article className="insight-tile"><h3>{t('Aktif ilanlar')}</h3><strong>{format(k.activeListings)}</strong><p className="insight-compare"><span>{t('Şu anda yayında, süresi dolmamış')}</span></p></article>
    {tile('expired',t('Süresi dolan ilanlar'),k.expiredListings)}
    {tile('messages',t('Mesajlar'),k.messages,<span>{t('Yeni konuşma')} <b>{format(k.conversations.current)}</b></span>)}
    {tile('leads',t('Müşteri talepleri'),k.leads,<span>{t('İlan sahiplerine gelen ilk mesajlar')}</span>)}
    {tile('views',t('İlan görüntülemeleri'),k.views,<span>{t('Günlük tekil ziyaretçi')}</span>)}
    {tile('reservations',t('Proje rezervasyon talepleri'),k.reservations)}
    {tile('orders',t('Siparişler'),k.orders?.created||null,k.orders&&<><span>{t('Tamamlanan')} <b>{format(k.orders.fulfilled.current)}</b></span><span>{t('Gelir')} <b>{money(k.orders.revenue.current)}</b></span></>)}
   </div>
   <div className="insight-row">
    <section className="admin-card insight-pending" aria-labelledby="insight-pending-title"><h3 id="insight-pending-title">{t('Bekleyen işler')}</h3><ul>{data.pending.map(p=><li key={p.kind}><Link href={p.href}><span>{t(PENDING[p.kind])}</span><b className={p.count?'has-items':''}>{p.count===null?'—':format(p.count)}</b><ArrowRight size={15} aria-hidden/></Link></li>)}</ul></section>
    <section className="admin-card insight-trend" aria-labelledby="insight-trend-title"><h3 id="insight-trend-title">{t('Günlük eğilim')}</h3>
     <div className="insight-charts">{SERIES.map(([key,label])=><DailyChart key={key} label={t(label)} peakLabel={t('En yüksek')} format={format} day={day} points={data.series.map(s=>({day:s.day,value:s[key]}))}/>)}</div>
     <details className="insight-table"><summary>{t('Tabloyu göster')}</summary><div className="insight-table-scroll"><table><caption className="sr-only">{t('Günlük eğilim')}</caption><thead><tr><th scope="col">{t('Gün')}</th>{SERIES.map(([key,label])=><th scope="col" key={key}>{t(label)}</th>)}</tr></thead><tbody>{data.series.map(s=><tr key={s.day}><th scope="row">{day(s.day)}</th><td>{format(s.listings)}</td><td>{format(s.users)}</td><td>{format(s.messages)}</td></tr>)}</tbody></table></div></details>
    </section>
   </div>
   <div className="insight-tops">
    <section className="admin-card"><h3>{t('En çok görüntülenen ilanlar')}</h3>{data.top.viewed===null?<p className="admin-muted">{t('Veri yok')}</p>:data.top.viewed.length?<ol>{data.top.viewed.map(v=><li key={v.id}><Link href={'/yonetim/ilan/'+v.id}><span><strong>{v.title}</strong><small>{[v.district,v.city].filter(Boolean).join(', ')}{!v.live&&<> · {t('Yayında değil')}</>}</small></span><b>{t('{n} görüntüleme').replace('{n}',format(v.views))}</b></Link></li>)}</ol>:<p className="admin-muted">{t('Bu dönemde kayıt yok.')}</p>}</section>
    <section className="admin-card"><h3>{t('En aktif ilan verenler')}</h3><p className="admin-muted">{t('Seçili dönemde eklenen ilanlara göre')}</p>{data.top.advertisers.length?<ol>{data.top.advertisers.map(a=><li key={a.id}><Link href={'/yonetim?view=messages&recipient='+a.id}><span><strong>{a.company||a.name}</strong><small>{a.company?a.name+' · ':''}{t(ROLES[a.kind]||'Alıcı')}</small></span><b>{t('{n} yeni ilan · {active} yayında').replace('{n}',format(a.listings)).replace('{active}',format(a.active))}</b></Link></li>)}</ol>:<p className="admin-muted">{t('Bu dönemde kayıt yok.')}</p>}</section>
    <section className="admin-card"><h3>{t('En çok ilanı olan iller')}</h3><p className="admin-muted">{t('Şu anda yayında olan ilanlara göre')}</p>{data.top.cities.length?<ol>{data.top.cities.map(c=><li key={c.city}><span><strong>{c.city}</strong></span><b>{t('{n} aktif ilan').replace('{n}',format(c.listings))}</b></li>)}</ol>:<p className="admin-muted">{t('Bu dönemde kayıt yok.')}</p>}</section>
   </div>
  </>}
 </section>;
}
