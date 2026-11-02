"use client";
import {useEffect,useSyncExternalStore} from "react";
import {Coins} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import type {ExchangeRates} from "@/lib/exchange-rates";
import {DISPLAY_CURRENCIES,DISPLAY_CURRENCY_KEY,convertPrice,defaultDisplayCurrency,isDisplayChoice,roundApprox,type DisplayChoice} from "@/lib/display-currency";

// One shared store per page: the visitor's choice (localStorage) and the daily rates, fetched once
// and only when a conversion is actually shown. Every card and price box reads the same store.
type Rates=Pick<ExchangeRates,'date'|'eurTry'|'usdTry'|'gbpTry'|'source'>;
const listeners=new Set<()=>void>();
let choice:DisplayChoice|null|undefined;
let rates:Rates|null=null,ratesRequested=false;
const emit=()=>listeners.forEach(listener=>listener());
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
function storedChoice(){
 if(choice===undefined){choice=null;try{const value=window.localStorage.getItem(DISPLAY_CURRENCY_KEY);if(isDisplayChoice(value))choice=value;}catch{}}
 return choice;
}
function loadRates(){
 if(ratesRequested)return;ratesRequested=true;
 fetch('/api/exchange-rates').then(response=>response.ok?response.json() as Promise<Rates>:null).then(data=>{if(data&&typeof data.eurTry==='number'&&typeof data.usdTry==='number'){rates=data;emit();}}).catch(()=>{ratesRequested=false;});
}
export function setDisplayCurrency(value:DisplayChoice){
 choice=value;try{window.localStorage.setItem(DISPLAY_CURRENCY_KEY,value);}catch{}emit();
}
// Keeps tabs in step when the choice changes in another tab.
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===DISPLAY_CURRENCY_KEY){choice=isDisplayChoice(event.newValue)?event.newValue:null;emit();}});

export function useDisplayCurrency(){
 const {locale}=useLocale();
 const stored=useSyncExternalStore(subscribe,storedChoice,()=>null);
 const current=useSyncExternalStore(subscribe,()=>rates,()=>null);
 const selected=stored||defaultDisplayCurrency(locale);
 useEffect(()=>{if(selected!=='off')loadRates();},[selected]);
 return {currency:selected,rates:current,setCurrency:setDisplayCurrency};
}

export function CurrencySelect({className=""}:{className?:string}){
 const {t}=useLocale();const {currency,setCurrency}=useDisplayCurrency();
 return <label className={`display-currency ${className}`} title={t("Fiyatların yaklaşık karşılığını seçtiğiniz para biriminde gösterir.")}><Coins size={15} aria-hidden="true"/><span>{t("Fiyatı göster")}</span><select value={currency} onChange={event=>{if(isDisplayChoice(event.target.value))setCurrency(event.target.value);}} aria-label={t("Yaklaşık fiyat için para birimi")}><option value="off">{t("Yalnızca ilan fiyatı")}</option>{DISPLAY_CURRENCIES.map(code=><option key={code} value={code}>{code}</option>)}</select></label>;
}

// "≈ €123.000" under the original price; nothing when the listing already uses that currency.
export function ApproxPrice({value,currency,className=""}:{value:number;currency:string;className?:string}){
 const {locale,t}=useLocale();const {currency:target,rates:current}=useDisplayCurrency();
 if(target==='off')return null;
 const converted=convertPrice(value,currency,target,current);
 if(converted==null||!current)return null;
 const amount=new Intl.NumberFormat(locale,{style:"currency",currency:target,maximumFractionDigits:0}).format(roundApprox(converted));
 const date=new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${current.date}T00:00:00Z`));
 const note=t("Yaklaşık değer: {date} tarihli günlük kurla hesaplanmıştır. İşlem kuru değildir; ilan fiyatı esastır.").replace("{date}",date);
 return <span className={`approx-price ${className}`} title={note}><span className="sr-only">{t("yaklaşık")} </span><span aria-hidden="true">≈ </span>{amount}</span>;
}
