"use client";
import {VerifiedBadge} from "@/components/VerifiedBadge";
import {purposeLabel,pricePeriod} from "@/lib/property-categories";
import {CompareButton} from "./Compare";
import Link from "@/components/SafeLink";
import { Heart, MapPin, ArrowUpRight, Images, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { formatPrice,formatUnitPrice, type Listing, typeLabel } from "@/lib/listings";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { favoriteIds, favoritesChanged } from "@/lib/favorites-client";
import {useContentTranslation} from './ContentTranslation';
export function ListingCard({listing,priority=false}: {listing:Listing;priority?:boolean}) {
  const {locale,t}=useLocale();
  const translated=useContentTranslation('listing',listing.id,{title:listing.title,description:listing.description});
  const title=locale==="tr"?listing.title:listing.translations?.[locale]?.title||translated.fields.title||listing.title;
  const [favorite,setFavorite]=useState(false);
  const [favoriteBusy,setFavoriteBusy]=useState(false),[favoriteError,setFavoriteError]=useState("");
  const [imageError,setImageError]=useState(false);
  // Photos can be browsed on the card itself (arrows, or a swipe on touch screens) without opening the listing.
  const [index,setIndex]=useState(0),touchX=useRef<number|null>(null),count=listing.images.length;
  const cover = listing.images[index]||listing.images[0];
  useEffect(()=>{setImageError(false);setIndex(0);},[listing.id]);
  const show=(step:number)=>{setImageError(false);setIndex(old=>(old+step+count)%count);};
  const step=(direction:number)=>(event:React.MouseEvent)=>{event.preventDefault();event.stopPropagation();show(direction);};
  useEffect(()=>{let active=true;const sync=()=>{favoriteIds().then((ids)=>{if(active)setFavorite(ids.includes(listing.id));});};sync();window.addEventListener("salesorrent:favorites-changed",sync);return()=>{active=false;window.removeEventListener("salesorrent:favorites-changed",sync);};},[listing.id]);
  async function toggle(){if(favoriteBusy)return;setFavoriteBusy(true);setFavoriteError("");try{const r=await fetch(favorite?`/api/favorites?id=${encodeURIComponent(listing.id)}`:"/api/favorites",{method:favorite?"DELETE":"POST",headers:favorite?undefined:{"Content-Type":"application/json"},body:favorite?undefined:JSON.stringify({id:listing.id})});if(r.status===401){window.location.href=`/giris?next=${encodeURIComponent(window.location.pathname+window.location.search)}`;return;}if(!r.ok)throw new Error("Favori güncellenemedi.");setFavorite(!favorite);favoritesChanged();}catch{setFavoriteError(t("Favori güncellenemedi."));}finally{setFavoriteBusy(false);}}

  return <article className="listing-card"><div className="listing-photo" onTouchStart={e=>{touchX.current=e.touches[0].clientX;}} onTouchEnd={e=>{const start=touchX.current;touchX.current=null;if(start==null||count<2)return;const dx=e.changedTouches[0].clientX-start;if(Math.abs(dx)>40)show(dx<0?1:-1);}}><Link href={`/ilan/${listing.id}`}>{!imageError&&cover?<img loading={priority?"eager":"lazy"} fetchPriority={priority?"high":undefined} decoding="async" src={cover} alt={title} onError={()=>setImageError(true)}/>:<span className="listing-image-placeholder"><Building2 size={36}/><small>ESTATEMARKET24</small></span>}</Link>{count>1&&<><button type="button" className="listing-photo-nav prev" onClick={step(-1)} aria-label={t("Önceki fotoğraf")}><ChevronLeft size={20}/></button><button type="button" className="listing-photo-nav next" onClick={step(1)} aria-label={t("Sonraki fotoğraf")}><ChevronRight size={20}/></button></>}<span className="listing-badge">{t(purposeLabel(listing.purpose)).toLocaleUpperCase(locale)}</span><button type="button" className={`favorite-button ${favorite?"selected":""}`} onClick={toggle} disabled={favoriteBusy} aria-pressed={favorite} aria-label={t(favorite?"Favorilerden çıkar":"Favorilere ekle")}><Heart size={19} fill={favorite?"currentColor":"none"}/></button>{favoriteError&&<span className="listing-favorite-notice" role="status">{t(favoriteError)}</span>}<div className="listing-photo-meta">{listing.source==="demo"&&<span>{t("Örnek ilan")}</span>}<span><Images size={13}/>{count>1?`${index+1}/${count}`:count}</span></div></div><div className="listing-info"><div className="listing-place"><MapPin size={14}/>{listing.district}, {listing.city}</div>{listing.ownerVerified&&<VerifiedBadge compact/>}<Link href={`/ilan/${listing.id}`} className="listing-title">{title}<ArrowUpRight size={18}/></Link><div className="listing-specs"><span>{t(typeLabel(listing.propertyType))}</span><i/><span>{listing.grossArea} m²</span>{listing.rooms&&<><i/><span>{listing.rooms}</span></>}</div><div className="listing-bottom"><strong>{formatPrice(listing.price,listing.currency,locale)}</strong>{pricePeriod(listing.purpose)&&<span>{t(pricePeriod(listing.purpose))}</span>}</div>{listing.purpose==="satilik"&&listing.grossArea>0&&<div className="listing-unit-price">{formatUnitPrice(listing.price/listing.grossArea,listing.currency,locale)} / m²</div>}<CompareButton id={listing.id}/></div></article>;
}

