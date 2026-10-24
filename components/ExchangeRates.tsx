'use client';
import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n';
import type {ExchangeRates as Rates} from '@/lib/exchange-rates';

export function ExchangeRates(){
  const {locale,t}=useLocale();
  const [rates,setRates]=useState<Rates|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const response=await fetch('/api/exchange-rates',{cache:'no-store'});
        if(!response.ok)throw Error('unavailable');
        const data=await response.json() as Rates;
        if(active){setRates(data);setUnavailable(false);}
      }catch{if(active){setRates(null);setUnavailable(true);}}
    };
    void load();
    const timer=window.setInterval(()=>{if(!document.hidden)void load();},30*60_000);
    const refresh=()=>{if(!document.hidden)void load();};
    document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const number=(value:number)=>new Intl.NumberFormat(locale,{minimumFractionDigits:4,maximumFractionDigits:4}).format(value);
  const date=rates?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${rates.date}T00:00:00Z`)):null;
  return <aside className="home-fx-card" aria-label={t('Güncel döviz referansı')} title={rates?`${t('Yayımlanma tarihi')}: ${date} · ECB · ${t('ECB referans kurları bilgilendirme amaçlıdır; işlem kuru değildir.')}`:undefined}>
    {rates?<div className="home-fx-rates"><div><span>1 EUR</span><strong>{number(rates.eurTry)} ₺</strong></div><div><span>1 USD</span><strong>{number(rates.usdTry)} ₺</strong></div></div>:<span className="home-fx-status" role="status">{t(unavailable?'Kur verisi şu anda alınamıyor.':'Kurlar yükleniyor...')}</span>}
  </aside>;
}
