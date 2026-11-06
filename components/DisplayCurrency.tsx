"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {AlertTriangle,Coins} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {TCMB_RATES_PAGE,TCMB_REFRESH_MS,bulletinUsable,type RateSnapshot} from "@/lib/tcmb";
import {COUNTRY_CURRENCY,CURRENCY_STORAGE_KEY,DISPLAY_CURRENCIES,currencyCookie,currencyName,currencySupported,formatMoney,formatRateDate,isSelectableCurrency,isolate,priceView,resolveDisplayCurrency,type DisplayCurrency,type PriceView,type SelectableCurrency} from "@/lib/display-currency";

// Display currency of listing prices for the whole page (lib/display-currency.ts). The server renders
// with the visitor's cookie and one TCMB snapshot (app/layout.tsx); the page keeps that snapshot and
// re-reads /api/exchange-rates every 15 minutes while it is open, so every price switches together.
type Value={rates:RateSnapshot|null;explicit:SelectableCurrency|null;setCurrency:(value:SelectableCurrency|null)=>void};
const CurrencyContext=createContext<Value>({rates:null,explicit:null,setCurrency:()=>{}});
const OLD_KEY="em24:display-currency";

function persist(value:SelectableCurrency|null){
 try{if(value)window.localStorage.setItem(CURRENCY_STORAGE_KEY,value);else window.localStorage.removeItem(CURRENCY_STORAGE_KEY);window.localStorage.removeItem(OLD_KEY);}catch{}
 // Strictly necessary preference cookie (cookie policy): lets the server render the chosen currency.
 document.cookie=currencyCookie(value)+(window.location.protocol==="https:"?"; Secure":"");
}

export function CurrencyProvider({initialRates,initialCurrency,children}:{initialRates:RateSnapshot|null;initialCurrency:SelectableCurrency|null;children:React.ReactNode}){
 const [rates,setRates]=useState<RateSnapshot|null>(initialRates);
 const [explicit,setExplicit]=useState<SelectableCurrency|null>(initialCurrency);
 const loadedAt=useRef(Date.now());
 useEffect(()=>{
  // The browser copy wins when the cookie is missing (e.g. cleared). The older display-currency
  // setting is dropped, not taken as an explicit choice, so the language default applies.
  try{
   const stored=window.localStorage.getItem(CURRENCY_STORAGE_KEY);window.localStorage.removeItem(OLD_KEY);
   const value=isSelectableCurrency(stored)?stored:null;
   if(value&&value!==initialCurrency){setExplicit(value);persist(value);}else if(!value&&initialCurrency)persist(initialCurrency);
  }catch{}
  const sync=(event:StorageEvent)=>{if(event.key===CURRENCY_STORAGE_KEY)setExplicit(isSelectableCurrency(event.newValue)?event.newValue:null);};
  window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync);
 },[initialCurrency]);
 useEffect(()=>{
  let active=true;
  // Background tabs skip the periodic reload; the first load (no server snapshot) always runs.
  const load=async(force=false)=>{
   if(document.hidden&&!force)return;loadedAt.current=Date.now();
   try{const response=await fetch("/api/exchange-rates",{cache:"no-store"});const data=response.ok?await response.json() as RateSnapshot:null;
    if(!active)return;
    // A failed reload keeps the bulletin on screen but marks it stale; it never invents a newer date.
    if(data&&bulletinUsable(data))setRates({...data,stale:Boolean(data.stale)});else setRates(old=>old?{...old,stale:true}:null);
   }catch{if(active)setRates(old=>old?{...old,stale:true}:null);}
  };
  if(!initialRates)void load(true);
  const timer=window.setInterval(()=>void load(),TCMB_REFRESH_MS);
  const visible=()=>{if(!document.hidden&&Date.now()-loadedAt.current>=TCMB_REFRESH_MS)void load();};
  document.addEventListener("visibilitychange",visible);
  return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[initialRates]);
 const setCurrency=useCallback((value:SelectableCurrency|null)=>{setExplicit(value);persist(value);},[]);
 const value=useMemo(()=>({rates,explicit,setCurrency}),[rates,explicit,setCurrency]);
 return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** The display currency (explicit choice, else the language default), the page's TCMB snapshot, and helpers. */
export function useDisplayCurrency(){
 const {locale}=useLocale();const {rates,explicit,setCurrency}=useContext(CurrencyContext);
 const currency:DisplayCurrency=resolveDisplayCurrency(explicit,locale);
 const supported=currencySupported(currency,rates);
 const view=useCallback((amount:number,from:string,options?:{round?:boolean}):PriceView=>priceView(amount,from,currency,rates,options),[currency,rates]);
 return {currency,explicit,rates,supported,setCurrency,view};
}

/** Plain text of a price in the display currency (titles, map labels, compare table); "≈" when converted. */
export function useMoneyText(){
 const {locale}=useLocale();const {view}=useDisplayCurrency();
 return useCallback((amount:number,currency:string,fractionDigits=0)=>{const shown=view(amount,currency,{round:fractionDigits===0});const converted=shown.kind==="converted",text=formatMoney(converted?Math.round(shown.amount):shown.amount,shown.currency,locale,converted?0:fractionDigits);return isolate(shown.kind==="converted"?`≈ ${text}`:text);},[locale,view]);
}

/** A stored price in the display currency. */
export function DisplayMoney({value,currency,fractionDigits=0}:{value:number;currency:string;fractionDigits?:number}){
 const {locale,t}=useLocale();const {view}=useDisplayCurrency();
 const shown=view(value,currency,{round:fractionDigits===0});
 // Converted amounts are whole units; a stored per-m² value may keep its decimals.
 const converted=shown.kind==="converted",text=formatMoney(converted?Math.round(shown.amount):shown.amount,shown.currency,locale,converted?0:fractionDigits);
 if(!converted)return <bdi>{text}</bdi>;
 return <bdi className="converted-money"><span className="sr-only">{t("yaklaşık")} </span><span aria-hidden="true">≈ </span>{text}</bdi>;
}

/** "Esas fiyat: ₺6.450.000" — the stored price, shown when the main amount is converted. */
export function BasePrice({value,currency}:{value:number;currency:string}){
 const {locale,t}=useLocale();const {view}=useDisplayCurrency();
 if(view(value,currency).kind!=="converted")return null;
 return <span className="base-price">{t("Esas fiyat")}: <bdi>{formatMoney(value,currency,locale)}</bdi></span>;
}

/** Credit and note under converted prices: compact on cards, full on the listing page. */
export function RateSource({currency,compact=false}:{currency:string;compact?:boolean}){
 const {locale,t}=useLocale();const {view,rates}=useDisplayCurrency();
 const shown=view(1_000_000,currency);
 if(shown.kind!=="converted"||!rates)return null;
 const note=currency==="TRY"?t("Yaklaşık karşılıktır. Esas ilan bedeli TL’dir."):t("Yaklaşık karşılıktır. Esas ilan bedeli {currency} cinsindendir.").replace("{currency}",currency);
 return <p className={`rate-source${compact?" compact":""}${rates.stale?" stale":""}`}>
  <span>{t("Kaynak")}: <a href={TCMB_RATES_PAGE} target="_blank" rel="noopener noreferrer" title={t("Türkiye Cumhuriyet Merkez Bankası")}>TCMB</a> · {t("Kur tarihi")}: <bdi>{formatRateDate(rates.date,locale)}</bdi></span>
  {rates.stale&&<span className="rate-source-warning"><AlertTriangle size={12} aria-hidden="true"/>{t("Kur verisi şu anda yenilenemiyor")}</span>}
  <span className="rate-source-note">{note}</span>
 </p>;
}

/** Once per page: why prices stay in TL (currency without a TCMB rate, or no usable bulletin). */
export function CurrencyNotice({className=""}:{className?:string}){
 const {locale,t}=useLocale();const {currency,rates,supported}=useDisplayCurrency();
 if(currency==="TRY"||supported)return null;
 const text=rates
  ?t("{currency} için TCMB kuru yayımlanmıyor; fiyatlar TL olarak gösteriliyor. Desteklenen para birimlerinden birini seçebilirsiniz.").replace("{currency}",currencyName(currency,locale))
  :t("Kur verisi şu anda alınamıyor; fiyatlar TL olarak gösteriliyor.");
 return <p className={`currency-notice ${className}`} role="note"><AlertTriangle size={14} aria-hidden="true"/><span>{text}</span></p>;
}

/** Compact "Para birimi / ülke" selector (header, search results, listing page). */
export function CurrencySwitch({className=""}:{className?:string}){
 const {locale,t}=useLocale();const {currency,explicit,setCurrency,rates}=useDisplayCurrency();
 const countries=useMemo(()=>{let names:Intl.DisplayNames|null=null;try{names=new Intl.DisplayNames(locale,{type:"region"});}catch{}
  return Object.entries(COUNTRY_CURRENCY).map(([code,value])=>({code,value,name:names?.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name,locale));},[locale]);
 const choose=(value:string)=>{if(value==="auto")setCurrency(null);else if(value.startsWith("country:")){const next=COUNTRY_CURRENCY[value.slice(8)];if(next)setCurrency(next);}else if(isSelectableCurrency(value))setCurrency(value);};
 const label=(code:string)=>`${code} · ${currencyName(code,locale)}${code!=="TRY"&&rates&&!rates.rates[code]?` (${t("kur yok")})`:""}`;
 return <label className={`currency-switch ${className}`.trim()} title={t("Fiyatların gösterileceği para birimi. İlan bedeli TL’dir; diğer tutarlar TCMB kuruyla yaklaşık hesaplanır.")}>
  <Coins size={15} aria-hidden="true"/><span className="currency-switch-hint">{t("Para birimi / ülke")}</span>
  <select value={explicit||"auto"} onChange={event=>choose(event.target.value)} aria-label={t("Para birimi / ülke")}>
   <option value="auto">{currency} · {t("Dile göre")}</option>
   <optgroup label={t("Para birimi")}>{DISPLAY_CURRENCIES.map(code=><option key={code} value={code}>{label(code)}</option>)}</optgroup>
   <optgroup label={t("Ülke")}>{countries.map(item=><option key={item.code} value={`country:${item.code}`}>{item.name} · {item.value}</option>)}</optgroup>
  </select>
 </label>;
}
