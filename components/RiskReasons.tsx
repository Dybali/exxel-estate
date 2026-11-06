'use client';
import {useLocale} from '@/lib/i18n';
import {CONTACT_KIND_LABELS,RISK_REASON_LABELS,type RiskReason} from '@/lib/listing-risk';

// One reason of the fraud and duplicate check (lib/listing-risk.ts) as a translated sentence.
export function useRiskReasonText(){
 const {t,locale}=useLocale(),number=new Intl.NumberFormat(locale==='tr'?'tr-TR':locale,{maximumFractionDigits:0});
 return (reason:RiskReason)=>{
  let text=t(RISK_REASON_LABELS[reason.code]||reason.code);
  for(const [key,value] of Object.entries(reason.params||{})){
   const shown=key==='kinds'?String(value).split(',').map(kind=>t(CONTACT_KIND_LABELS[kind]||kind)).join(', '):typeof value==='number'?number.format(value):String(value);
   text=text.split(`{${key}}`).join(shown);
  }
  return text;
 };
}

export function RiskScore({score,level}:{score:number;level:string}){
 const {t}=useLocale();
 return <span className={'admin-badge risk-score '+(level==='high'?'bad':level==='medium'?'pending':'neutral')}>{t(level==='high'?'Yüksek risk':level==='medium'?'Orta risk':'Düşük risk')} · {score}/100</span>;
}

export function RiskReasonList({reasons}:{reasons:RiskReason[]}){
 const text=useRiskReasonText();
 return <ul className="risk-reasons">{reasons.map(reason=><li key={reason.code}><span>{text(reason)}</span><b dir="ltr">+{reason.weight}</b></li>)}</ul>;
}
