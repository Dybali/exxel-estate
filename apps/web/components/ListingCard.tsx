"use client";
import Link from "@/components/SafeLink";
import { Heart, MapPin, ArrowUpRight, Images, Building2 } from "lucide-react";
import { formatPrice, type Listing, typeLabel } from "@/lib/listings";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
let favoritesRequest:Promise<string[]>|null=null;
function favoriteIds(){if(!favoritesRequest)favoritesRequest=fetch("/api/favorites").then((r)=>r.ok?r.json():{ids:[]}).then((data:any)=>data.ids||[]).catch(()=>[]);return favoritesRequest}
export function ListingCard({listing}: {listing:Listing}) {
  const {locale,t}=useLocale();
  const title=locale==="tr"?listing.title:listing.translations?.[locale]?.title||listing.title;
  const [favorite,setFavorite]=useState(false);
  const [imageError,setImageError]=useState(false);
  useEffect(()=>setImageError(false),[listing.id]);
  useEffect(()=>{favoriteIds().then((ids)=>setFavorite(ids.includes(listing.id)));},[listing.id]);
  async function toggle(){const r=await fetch(favorite?`/api/favorites?id=${encodeURIComponent(listing.id)}`:"/api/favorites",{method:favorite?"DELETE":"POST",headers:favorite?undefined:{"Content-Type":"application/json"},body:favorite?undefined:JSON.stringify({id:listing.id})});if(r.status===401){window.location.href=`/giris?next=${encodeURIComponent(window.location.pathname)}`;return;}if(r.ok){setFavorite(!favorite);favoritesRequest=null}}
  return <article className="listing-card"><div className="listing-photo"><Link href={`/ilan/${listing.id}`}>{!imageError&&listing.images[0]?<img loading="lazy" src={listing.images[0]} alt={title} onError={()=>setImageError(true)}/>:<span className="listing-image-placeholder"><Building2 size={36}/><small>EXXEL ESTATE</small></span>}</Link><span className="listing-badge">{t(listing.purpose==="satilik"?"Satılık":"Kiralık").toLocaleUpperCase(locale)}</span><button type="button" className={`favorite-button ${favorite?"selected":""}`} onClick={toggle} aria-label={t(favorite?"Favorilerden çıkar":"Favorilere ekle")}><Heart size={19} fill={favorite?"currentColor":"none"}/></button><div className="listing-photo-meta">{listing.source==="demo"&&<span>{t("Örnek ilan")}</span>}<span><Images size={13}/>{listing.images.length}</span></div></div><div className="listing-info"><div className="listing-place"><MapPin size={14}/>{listing.district}, {listing.city}</div><Link href={`/ilan/${listing.id}`} className="listing-title">{title}<ArrowUpRight size={18}/></Link><div className="listing-specs"><span>{t(typeLabel(listing.propertyType))}</span><i/><span>{listing.grossArea} m²</span>{listing.rooms&&<><i/><span>{listing.rooms}</span></>}</div><div className="listing-bottom"><strong>{formatPrice(listing.price,listing.currency,locale)}</strong>{listing.purpose==="kiralik"&&<span>{t("/ ay")}</span>}</div>{listing.purpose==="satilik"&&listing.grossArea>0&&<div className="listing-unit-price">{formatPrice(Math.round(listing.price/listing.grossArea),listing.currency,locale)} / m²</div>}</div></article>;
}

