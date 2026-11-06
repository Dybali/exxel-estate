"use client";
import {useEffect,useState} from "react";
import {Bus,Hospital,Landmark,Pill,School,Ship,ShoppingCart,TrainFront,TrainTrack,TramFront,Trees,Umbrella,WavesHorizontal,type LucideIcon} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {nearbyNeedsRefresh,walkingMinutes,type NearbyInfo,type NearbyType} from "@/lib/neighborhood-info";

const TYPES:Record<NearbyType,[string,LucideIcon]>={school:["Okul",School],hospital:["Hastane",Hospital],pharmacy:["Eczane",Pill],supermarket:["Süpermarket",ShoppingCart],metro:["Metro istasyonu",TrainFront],rail:["Tren istasyonu",TrainTrack],tram:["Tramvay durağı",TramFront],bus:["Otobüs durağı",Bus],ferry:["Vapur iskelesi",Ship],beach:["Plaj",Umbrella],sea:["Deniz kıyısı",WavesHorizontal],park:["Park",Trees],mosque:["Cami",Landmark]};

/**
 * "Mahalle bilgisi" on a listing page: nearest places within 2 km of the public point, stored by the
 * server in presentation.nearby (lib/neighborhood-info.ts). Fetched from our API only when the
 * stored block is missing or stale; the browser never contacts Overpass.
 */
export function NeighbourhoodInfo({listingId,initial,point,approximate}:{listingId:string;initial:NearbyInfo|null;point:[number,number];approximate:boolean}){
 const {t,locale}=useLocale();
 const stale=nearbyNeedsRefresh(initial,point[0],point[1]);
 const [info,setInfo]=useState<NearbyInfo|null>(initial),[loading,setLoading]=useState(stale),[failed,setFailed]=useState(false);
 useEffect(()=>{if(!stale)return;const controller=new AbortController();fetch(`/api/listings/${encodeURIComponent(listingId)}/nearby`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{available:boolean;nearby?:NearbyInfo|null}>;}).then(data=>{if(controller.signal.aborted)return;if(data.nearby)setInfo(data.nearby);else setFailed(true);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[listingId,stale]);
 const number=(value:number)=>new Intl.NumberFormat(locale).format(value);
 const distance=(meters:number)=>meters<1000?`${number(Math.round(meters/10)*10)} m`:`${new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(meters/1000)} km`;
 const items=info&&!info.failed?info.items:[];
 const rough=approximate||info?.approximate;
 return <section className="property-section neighbourhood-info" aria-busy={loading}>
  <h2>{t("Mahalle bilgisi")}</h2>
  <p className="neighbourhood-intro">{t(rough?"İlanın yaklaşık konumuna göre 2 km içindeki en yakın yerler. Mesafeler yaklaşıktır.":"İlanın konumuna göre 2 km içindeki en yakın yerler.")}</p>
  {loading&&!items.length?<p className="neighbourhood-note" role="status">{t("Mahalle bilgisi yükleniyor...")}</p>
   :items.length?<ul className="neighbourhood-list">{items.map(item=>{const [label,Icon]=TYPES[item.type]||["",School];if(!label)return null;return <li key={item.type}><Icon size={18} aria-hidden="true"/><span><strong>{t(label)}</strong>{item.name&&<small><bdi>{item.name}</bdi></small>}</span><span className="neighbourhood-distance"><b><bdi>{rough?"~":""}{distance(item.distanceM)}</bdi></b><small>{t("{n} dk yürüme").replace("{n}",number(walkingMinutes(item.distanceM)))}</small></span></li>;})}</ul>
   :<p className="neighbourhood-note">{t(failed||info?.failed?"Mahalle bilgisi şu anda alınamadı.":"2 km içinde kayıtlı yer bulunamadı.")}</p>}
  <p className="neighbourhood-source">{t("Yürüme süresi düz çizgi mesafesinden tahmin edilir. Veriler eksik olabilir.")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© {t("OpenStreetMap katkıcıları")}</a> (ODbL)</p>
 </section>;
}
