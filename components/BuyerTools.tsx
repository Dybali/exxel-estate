"use client";
import {useEffect,useState} from "react";
import {Calculator,ChartColumn} from "lucide-react";
import {Money,useLocale} from "@/lib/i18n";
import {loanSummary} from "@/lib/buyer-tools";
import type {Listing} from "@/lib/listings";

type Area={count:number;median:number|null};
type Market={city:Area;district:Area;minimum:number};

// Loan calculator and local price per m² for a listing page (nearby places: components/NeighbourhoodInfo.tsx).
export function BuyerTools({listing}:{listing:Listing}){
 const {t,locale}=useLocale(),forSale=listing.purpose==="satilik";
 const [down,setDown]=useState(30),[rate,setRate]=useState(2.5),[months,setMonths]=useState(120);
 const [market,setMarket]=useState<Market|null>(null);
 const loan=loanSummary(listing.price,down,rate,months);
 const area=listing.netArea||listing.grossArea,perM2=area>0?listing.price/area:0;
 useEffect(()=>{if(listing.source==="demo"||!(perM2>0))return;const q=new URLSearchParams({city:listing.city,district:listing.district,purpose:listing.purpose,currency:listing.currency});fetch(`/api/market-prices?${q}`).then(r=>r.ok?r.json() as Promise<Market>:null).then(setMarket).catch(()=>{});},[listing.city,listing.district,listing.purpose,listing.currency,listing.source,perM2]);
 const reference=market?.district.median!=null?{label:"İlçe medyanı",value:market.district.median,count:market.district.count}:market?.city.median!=null?{label:"İl medyanı",value:market.city.median,count:market.city.count}:null;
 const difference=reference&&perM2>0?Math.round((perM2/reference.value-1)*100):null;
 const number=(value:number)=>new Intl.NumberFormat(locale).format(value);
 return <section className="property-section buyer-tools"><h2>{t("Alıcı araçları")}</h2><div className="buyer-tools-grid">
  {forSale&&<article className="buyer-tool"><h3><Calculator size={17}/>{t("Kredi hesaplayıcı")}</h3>
   <div className="buyer-tool-inputs">
    <label>{t("Peşinat (%)")}<input type="number" min={0} max={100} step={5} value={down} onChange={e=>setDown(Math.min(100,Math.max(0,Number(e.target.value)||0)))}/></label>
    <label>{t("Aylık faiz oranı (%)")}<input type="number" min={0} max={10} step={0.01} value={rate} onChange={e=>setRate(Math.min(10,Math.max(0,Number(e.target.value)||0)))}/></label>
    <label>{t("Vade (ay)")}<input type="number" min={1} max={360} step={12} value={months} onChange={e=>setMonths(Math.min(360,Math.max(1,Math.round(Number(e.target.value)||1))))}/></label>
   </div>
   <dl className="buyer-tool-result"><div className="buyer-tool-main"><dt>{t("Aylık taksit")}</dt><dd><Money value={loan.monthly} currency={listing.currency}/></dd></div><div><dt>{t("Kredi tutarı")}</dt><dd><Money value={loan.principal} currency={listing.currency}/></dd></div><div><dt>{t("Toplam geri ödeme")}</dt><dd><Money value={loan.total} currency={listing.currency}/></dd></div><div><dt>{t("Toplam faiz")}</dt><dd><Money value={loan.interest} currency={listing.currency}/></dd></div></dl>
   <p className="buyer-tool-note">{t("Hesaplama bilgi amaçlıdır. Güncel faiz oranı, masraflar ve yabancılara kredi koşulları için bankanızla görüşün.")}</p>
  </article>}
  {listing.source!=="demo"&&perM2>0&&<article className="buyer-tool"><h3><ChartColumn size={17}/>{t("Bölge m² fiyatı")}</h3>
   <dl className="buyer-tool-result"><div className="buyer-tool-main"><dt>{t("Bu ilan")}</dt><dd><Money value={perM2} currency={listing.currency}/> / m²</dd></div>{reference&&<div><dt>{t(reference.label)} · {number(reference.count)} {t("ilan")}</dt><dd><Money value={reference.value} currency={listing.currency}/> / m²</dd></div>}</dl>
   {difference!=null?<p className={`buyer-tool-compare ${difference>5?"above":difference<-5?"below":"near"}`}>{Math.abs(difference)<=5?t("Bölge medyanına yakın"):`%${number(Math.abs(difference))} ${t(difference>0?"medyanın üstünde":"medyanın altında")}`}</p>:market&&<p className="buyer-tool-note">{t("Karşılaştırma için bu bölgede yeterli ilan yok.")}</p>}
   <p className="buyer-tool-note">{t("Yayındaki ilanların m² fiyatlarından hesaplanır; değerleme değildir.")}</p>
  </article>}
 </div></section>;
}
