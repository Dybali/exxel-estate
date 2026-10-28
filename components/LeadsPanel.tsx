"use client";
import {useEffect,useState} from "react";
import Link from "@/components/SafeLink";
import {MessageSquare,TrendingUp} from "lucide-react";
import {apiJson} from "@/lib/api-client";
import {useLocale} from "@/lib/i18n";
import {LEAD_STAGES,type Lead,type LeadStage} from "@/lib/leads";
import {ListingImport} from "./ListingImport";

type Performance={days:number;series:{day:string;views:number}[];top:{id:string;title:string;views:number}[]};
const STAGE_LABELS:Record<LeadStage,string>={new:"Yeni müşteri",contacted:"İletişime geçildi",viewing:"Gösterim aşaması",offer:"Teklif aşaması",closed:"Tamamlandı"};

function LeadRow({lead,onSaved}:{lead:Lead;onSaved:(lead:Lead)=>void}){
 const {t,locale}=useLocale(),[stage,setStage]=useState(lead.stage),[note,setNote]=useState(lead.note),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const changed=stage!==lead.stage||note.trim()!==lead.note;
 async function save(){setBusy(true);setMessage("");try{const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({listingId:lead.listingId,contactId:lead.contactId,stage,note})});const data=await apiJson<{error?:string;stage:LeadStage;note:string}>(r);if(!r.ok)throw Error(data.error||"Kaydedilemedi.");onSaved({...lead,stage:data.stage,note:data.note});setMessage(t("Kaydedildi."));}catch(cause){setMessage(t((cause as Error).message));}finally{setBusy(false);}}
 return <li className={`lead-row stage-${lead.stage}`}><div className="lead-head"><strong>{lead.contactName}</strong><span>{new Intl.DateTimeFormat(locale,{dateStyle:"medium"}).format(new Date(lead.lastAt))}</span></div>
  <p className="lead-listing"><Link href={`/ilan/${lead.listingId}`}>{lead.listingTitle}</Link> · {lead.messages} <MessageSquare size={12}/></p>
  <div className="lead-edit"><label>{t("Aşama")}<select value={stage} onChange={e=>setStage(e.target.value as LeadStage)}>{LEAD_STAGES.map(value=><option key={value} value={value}>{t(STAGE_LABELS[value])}</option>)}</select></label><label>{t("Özel müşteri notu")}<textarea value={note} maxLength={2000} rows={2} onChange={e=>setNote(e.target.value)}/></label></div>
  <div className="lead-actions"><Link className="outline-button" href={`/hesabim?tab=mesajlar&listingId=${encodeURIComponent(lead.listingId)}&peerId=${encodeURIComponent(lead.contactId)}`}>{t("Mesajı aç")}</Link><button type="button" className="outline-button" disabled={!changed||busy} onClick={save}>{t(busy?"Kaydediliyor...":"Kaydet")}</button>{message&&<span role="status">{message}</span>}</div>
 </li>;
}

// Enquiries with stage tracking, 30-day view trend and XML import for listing owners.
export function LeadsPanel(){
 const {t,locale}=useLocale(),[leads,setLeads]=useState<Lead[]|null>(null),[performance,setPerformance]=useState<Performance|null>(null),[filter,setFilter]=useState<LeadStage|"all">("all"),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/leads",{cache:"no-store"}).then(async r=>{const data=await apiJson<{error?:string;leads:Lead[];performance:Performance}>(r);if(!r.ok)throw Error(data.error||"Talepler yüklenemedi.");setLeads(data.leads);setPerformance(data.performance);}).catch(cause=>setError((cause as Error).message));},[]);
 const counts=Object.fromEntries(LEAD_STAGES.map(stage=>[stage,(leads||[]).filter(lead=>lead.stage===stage).length]));
 const visible=(leads||[]).filter(lead=>filter==="all"||lead.stage===filter);
 const peak=Math.max(1,...(performance?.series||[]).map(d=>d.views)),total=(performance?.series||[]).reduce((n,d)=>n+d.views,0);
 return <section className="leads-panel"><h2>{t("Müşteri talepleri")}</h2><p className="leads-intro">{t("İlanlarınıza mesaj yazan kişiler burada listelenir. Aşama ve notlar yalnızca size görünür.")}</p>
  {error&&<p className="form-error" role="alert">{t(error)}</p>}
  {performance&&<article className="leads-performance"><h3><TrendingUp size={17}/>{t("Son 30 gün görüntülenme")} · {new Intl.NumberFormat(locale).format(total)}</h3><div className="leads-chart" role="img" aria-label={`${t("Son 30 gün görüntülenme")}: ${total}`}>{performance.series.map(d=><span key={d.day} title={`${d.day}: ${d.views}`} style={{height:`${Math.max(3,(d.views/peak)*100)}%`}}/>)}</div>
   {performance.top.length>0&&<ol className="leads-top">{performance.top.map(item=><li key={item.id}><Link href={`/ilan/${item.id}`}>{item.title}</Link><span>{new Intl.NumberFormat(locale).format(item.views)}</span></li>)}</ol>}</article>}
  {leads&&<><div className="leads-filters" role="group" aria-label={t("Aşama")}><button type="button" className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>{t("Tümü")} · {leads.length}</button>{LEAD_STAGES.map(stage=><button type="button" key={stage} className={filter===stage?"active":""} onClick={()=>setFilter(stage)}>{t(STAGE_LABELS[stage])} · {counts[stage]}</button>)}</div>
   {visible.length?<ul className="leads-list">{visible.map(lead=><LeadRow key={`${lead.listingId}:${lead.contactId}`} lead={lead} onSaved={next=>setLeads(old=>(old||[]).map(item=>item.listingId===next.listingId&&item.contactId===next.contactId?next:item))}/>)}</ul>:<p className="leads-empty">{t("Henüz müşteri talebi yok.")}</p>}</>}
  {!leads&&!error&&<p>{t("Talepler yükleniyor...")}</p>}
  <ListingImport/>
 </section>;
}
