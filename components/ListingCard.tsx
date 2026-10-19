"use client";
import {CompareButton} from "./Compare";
import Link from "@/components/SafeLink";
import { Heart, MapPin, ArrowUpRight, Images, Building2 } from "lucide-react";
import { formatPrice, type Listing, typeLabel } from "@/lib/listings";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { favoriteIds, favoritesChanged } from "@/lib/favorites-client";
export function ListingCard({listing}: {listing:Listing}) {
  const {locale,t}=useLocale();
  const title=locale==="tr"?listing.title:listing.translations?.[locale]?.title||listing.title;
  const [favorite,setFavorite]=useState(false);
  const [favoriteBusy,setFavoriteBusy]=useState(false),[favoriteError,setFavoriteError]=useState("");
  const [imageError,setImageError]=useState(false);
  const cover = (() => {
    const source = listing.images[0];
    if (!source || listing.source !== "demo") return source;
    try {
      const url = new URL(source);
      if (url.hostname !== "images.unsplash.com") return source;
      url.searchParams.set("w", "680");
      url.searchParams.set("q", "74");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("auto", "format");
      return url.toString();
    } catch { return source; }
  })();
  useEffect(()=>setImageError(false),[listing.id]);
  useEffect(()=>{let active=true;const sync=()=>{favoriteIds().then((ids)=>{if(active)setFavorite(ids.includes(listing.id));});};sync();window.addEventListener("salesorrent:favorites-changed",sync);return()=>{active=false;window.removeEventListener("salesorrent:favorites-changed",sync);};},[listing.id]);
  async function toggle(){if(favoriteBusy)return;setFavoriteBusy(true);setFavoriteError("");try{const r=await fetch(favorite?`/api/favorites?id=${encodeURIComponent(listing.id)}`:"/api/favorites",{method:favorite?"DELETE":"POST",headers:favorite?undefined:{"Content-Type":"application/json"},body:favorite?undefined:JSON.stringify({id:listing.id})});if(r.status===401){window.location.href=`/giris?next=${encodeURIComponent(window.location.pathname+window.location.search)}`;return;}if(!r.ok)throw new Error("Favori güncellenemedi.");setFavorite(!favorite);favoritesChanged();}catch{setFavoriteError(t("Favori güncellenemedi."));}finally{setFavoriteBusy(false);}}

  return <article className="listing-card"><div className="listing-photo"><Link href={`/ilan/${listing.id}`}>{!imageError&&cover?<img loading="lazy" decoding="async" src={cover} alt={title} onError={()=>setImageError(true)}/>:<span className="listing-image-placeholder"><Building2 size={36}/><small>ESTATEMARKET24</small></span>}</Link><span className="listing-badge">{t(listing.purpose==="satilik"?"Satılık":"Kiralık").toLocaleUpperCase(locale)}</span><button type="button" className={`favorite-button ${favorite?"selected":""}`} onClick={toggle} disabled={favoriteBusy} aria-pressed={favorite} aria-label={t(favorite?"Favorilerden çıkar":"Favorilere ekle")}><Heart size={19} fill={favorite?"currentColor":"none"}/></button>{favoriteError&&<span className="listing-favorite-notice" role="status">{favoriteError}</span>}<div className="listing-photo-meta">{listing.source==="demo"&&<span>{t("Örnek ilan")}</span>}<span><Images size={13}/>{listing.images.length}</span></div></div><div className="listing-info"><div className="listing-place"><MapPin size={14}/>{listing.district}, {listing.city}</div><Link href={`/ilan/${listing.id}`} className="listing-title">{title}<ArrowUpRight size={18}/></Link><div className="listing-specs"><span>{t(typeLabel(listing.propertyType))}</span><i/><span>{listing.grossArea} m²</span>{listing.rooms&&<><i/><span>{listing.rooms}</span></>}</div><div className="listing-bottom"><strong>{formatPrice(listing.price,listing.currency,locale)}</strong>{listing.purpose==="kiralik"&&<span>{t("/ ay")}</span>}</div>{listing.purpose==="satilik"&&listing.grossArea>0&&<div className="listing-unit-price">{formatPrice(Math.round(listing.price/listing.grossArea),listing.currency,locale)} / m²</div>}<CompareButton id={listing.id}/></div></article>;
}

