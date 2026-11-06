'use client';
import {useLocale} from '@/lib/i18n';
import {TCMB_RATES_PAGE} from '@/lib/tcmb';
import {formatRateDate} from '@/lib/display-currency';
import {useDisplayCurrency} from './DisplayCurrency';

// Homepage currency strip: TCMB indicative selling rates (TL per unit) from the page's snapshot, which
// CurrencyProvider re-reads every 15 minutes. The bulletin date is shown as published, never as "now".
const CODES=['USD','EUR','GBP','CHF','SAR','AED','RUB'];
export function ExchangeRates(){
  const {locale,t}=useLocale();
  const {rates}=useDisplayCurrency();
  const number=(value:number)=>new Intl.NumberFormat(locale,{minimumFractionDigits:4,maximumFractionDigits:4}).format(value);
  const date=rates?formatRateDate(rates.date,locale):null;
  const items=rates?CODES.map(code=>({code,value:rates.rates[code]})).filter((item):item is {code:string;value:number}=>typeof item.value==='number'&&Number.isFinite(item.value)&&item.value>0):[];
  const group=(hidden:boolean)=><div className="home-fx-rates" aria-hidden={hidden||undefined}>{items.map(item=><div key={item.code}><span>1 {item.code}</span><strong><bdi>{number(item.value)} ₺</bdi></strong></div>)}<div className="home-fx-source"><span>{t('Kaynak')}: <a href={TCMB_RATES_PAGE} target="_blank" rel="noopener noreferrer" title={t('Türkiye Cumhuriyet Merkez Bankası')} tabIndex={hidden?-1:undefined}>TCMB</a></span><span>{t('Kur tarihi')}:</span><strong><bdi>{date}</bdi></strong>{rates?.stale&&<span className="home-fx-stale">{t('Kur verisi şu anda yenilenemiyor')}</span>}</div></div>;
  return <aside className="home-fx-card" aria-label={t('TCMB döviz kurları')} title={rates?`${t('Kaynak')}: TCMB · ${t('Kur tarihi')}: ${date} · ${t('Kurlar bilgilendirme amaçlıdır; işlem kuru değildir.')}`:undefined}>
    {items.length?<div className="home-fx-viewport" tabIndex={0}><div className="home-fx-track">{group(false)}{group(true)}</div></div>:<span className="home-fx-status" role="status">{t('Kur verisi şu anda alınamıyor.')}</span>}
  </aside>;
}
