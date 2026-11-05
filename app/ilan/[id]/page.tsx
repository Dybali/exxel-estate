import { landFacts } from "@/lib/land";
import { SUBTYPES } from "@/lib/property-subtypes";
import { detailFacts, FOREIGN_SALE, foreignSaleApplies, foreignSaleOf } from "@/lib/listing-details";
import { ApproxPrice, CurrencySelect } from "@/components/DisplayCurrency";
import { CITIZENSHIP_PATH, FOREIGN_BUYER_PATH } from "@/lib/citizenship-guide";
import {VerifiedBadge} from "@/components/VerifiedBadge";
import {ListingViewTracker} from "@/components/ListingViewTracker";
import {ListingDates} from "@/components/ListingDates";
import {purposeLabel,pricePeriod} from "@/lib/property-categories";
import {publicListing} from '@/lib/listings';
import {PropertyPresentation} from "@/components/PropertyPresentation";
import Link from "@/components/SafeLink";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Globe2, MapPin } from "lucide-react";
import { typeLabel } from "@/lib/listings";
import { db, listingById, OWNER_VERIFIED_SQL, parseListing } from "@/lib/server";
import { PUBLIC_DEMO_LISTINGS } from "@/lib/listings";
import { similarIn, SIMILAR_LIMIT, similarListings, similarSearchHref, type SimilarDatabase } from "@/lib/similar-listings";
import { PRICE_DROP_SQL, PRICE_HISTORY_SQL, priceHistory, type PriceHistoryRow } from "@/lib/price-history";
import { SimilarListings } from "@/components/SimilarListings";
import { regionPath } from "@/lib/region-pages";
import { PriceDropNote, PriceHistoryPanel } from "@/components/PriceHistory";
import { readyListingVideo, type VideoDatabase } from "@/lib/listing-video-store";
import { videoFeatureEnabled } from "@/lib/listing-video-server";
import type { Metadata } from "next";
import { ContactCard } from "@/components/ContactCard";
import { T, Money } from "@/lib/i18n";
import { translate } from "@/lib/i18n-dictionary";
import { ListingGallery } from "@/components/ListingGallery";
import { PropertyText } from "@/components/PropertyText";
import { ExternalMap } from "@/components/ExternalMap";
import { BuyerTools } from "@/components/BuyerTools";
import { ServiceSuggestions } from "@/components/ServiceSuggestions";
import { listingAuthorityNumber } from "@/lib/office-verification-server";
import { listingStructuredData, localizedListingText } from "@/lib/listing-seo";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { shareMetadata } from "@/lib/share-metadata";
import { listingShareImages } from "@/lib/share-image-policy";
export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params, listing=await listingById(id);
  if(!listing || listing.source==='user'&&listing.status!=='published')return {title:`${translate('İlan bulunamadı',await requestLocale())} | estatemarket24`,robots:{index:false,follow:false}};
  const locale=await requestLocale(),text=localizedListingText(listing,locale),description=text.description.slice(0,155);
  const path=`/ilan/${listing.id}`;
  return {title:`${text.title} | estatemarket24`,description,alternates:await pageAlternates(path),...(listing.source==='demo'?{robots:{index:false,follow:true}}:{}),...shareMetadata({title:text.title,description,path,locale,image:listingShareImages(listing,locale)})};
}
export default async function Detail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params,original=await listingById(id),listing=original?publicListing(original):null,locale=await requestLocale();
  if(!listing||listing.status&&listing.status!=='published'&&listing.source!=='demo')notFound();
  const map=listing.latitude!=null&&listing.longitude!=null?`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude-.012}%2C${listing.latitude-.009}%2C${listing.longitude+.012}%2C${listing.latitude+.009}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`:null;
  const facts:[string,React.ReactNode][]=[['İlan türü',<T key="purpose" id={purposeLabel(listing.purpose)}/>],['Gayrimenkul tipi',<T key="type" id={typeLabel(listing.propertyType)}/>],['Brüt alan',`${listing.grossArea} m²`]];
  const subtype=SUBTYPES[listing.propertyType],subtypeValue=subtype&&listing.presentation?.[subtype.field];
  if(subtype&&subtypeValue)facts.splice(2,0,[subtype.label,<T key="subtype" id={subtypeValue}/>]);
  if(listing.propertyType==='arsa'){facts.splice(2,1,['m²',`${listing.grossArea} m²`]);for(const [label,value] of landFacts(listing.presentation?.land))facts.push([label,<T key={label} id={value}/>]);}
  else{if(listing.presentation?.plotArea!=null)facts.push(['Arsa alanı',`${listing.presentation.plotArea} m²`]);if(listing.presentation?.gardenArea!=null)facts.push(['Bahçe alanı',`${listing.presentation.gardenArea} m²`]);
  if(listing.netArea)facts.push(['Net alan',`${listing.netArea} m²`]);if(listing.rooms)facts.push(['Oda düzeni',listing.rooms]);if(listing.bedrooms!=null)facts.push(['Yatak odası',listing.bedrooms]);if(listing.bathrooms!=null)facts.push(['Banyo',listing.bathrooms]);if(listing.buildingAge!=null)facts.push(['Bina yaşı',listing.buildingAge===0?<T key="new" id="Yeni"/>:listing.buildingAge]);if(listing.floor!=null)facts.push(['Bulunduğu kat',listing.floor]);if(listing.totalFloors!=null)facts.push(['Kat sayısı',listing.totalFloors]);if(listing.heating)facts.push(['Isıtma',<T key="heating" id={listing.heating}/>]);facts.push(['Eşyalı',<T key="furnished" id={listing.furnished==null?'Belirtilmemiş':listing.furnished?'Evet':'Hayır'}/>]);}
  for(const [label,value] of detailFacts(listing.propertyType,listing.presentation?.details))facts.push([label,<T key={`detail-${label}`} id={value}/>]);
  const foreignSale=foreignSaleOf(listing);
  if(foreignSaleApplies(listing.purpose,listing.propertyType))facts.push([FOREIGN_SALE.label,<T key="foreign-sale" id={foreignSale||"Belirtilmemiş"}/>]);
  if(listing.source!=='demo')facts.push(['Kimden',<T key="from" id={listing.ownerRole==='agent'?'Emlak Ofisinden':'Sahibinden'}/>]);
  const authorityNumber=listing.source==='demo'?null:await listingAuthorityNumber(listing.id),eids=listing.presentation?.eidsNumber;
  // Uploaded video: shown only once processed (docs/listing-videos.md).
  const videoId=listing.presentation?.videoId,video=videoId&&listing.source!=='demo'&&videoFeatureEnabled()?await readyListingVideo(db() as unknown as VideoDatabase,videoId,listing.id).catch(()=>null):null;
  // Both are extras: a failure leaves the page as it was (a demo page still gets demo suggestions).
  const [similar,historyRows]=await Promise.all([
    (async()=>similarListings(db() as unknown as SimilarDatabase,listing,{parse:row=>publicListing(parseListing(row)),columns:[OWNER_VERIFIED_SQL,PRICE_DROP_SQL],demos:PUBLIC_DEMO_LISTINGS}))().catch(()=>listing.source==='demo'?similarIn(listing,PUBLIC_DEMO_LISTINGS).slice(0,SIMILAR_LIMIT):[]),
    (async()=>listing.source==='demo'?[]:(await db().prepare(PRICE_HISTORY_SQL).bind(listing.id).all<PriceHistoryRow>()).results||[])().catch(()=>[] as PriceHistoryRow[]),
  ]);
  const history=priceHistory(historyRows,listing);
  // Breadcrumb city and district open the region pages (/emlak/...) when the place is a known Turkish location.
  const districtPath=regionPath({city:listing.city,district:listing.district});
  const structured=listing.source==='demo'?null:listingStructuredData(listing,localizedListingText(listing,locale));
  return <main className="property-detail-page">{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/>}<ListingViewTracker id={listing.id}/><div className="container">
    <nav className="property-breadcrumb" aria-label={translate("Sayfa konumu",locale)}><Link href="/ilanlar"><ArrowLeft size={15}/><T id="İlanlar"/></Link><ChevronRight size={13}/><Link href={regionPath({city:listing.city})||`/ilanlar?city=${encodeURIComponent(listing.city)}`}>{listing.city}</Link><ChevronRight size={13}/>{districtPath?<Link href={districtPath}>{listing.district}</Link>:<span>{listing.district}</span>}</nav>
    <ListingGallery listingId={listing.id} images={listing.images} title={listing.title} panoramas={listing.presentation?.panoramas} floorPlan={listing.presentation?.floorPlan} video={video}/>
    <div className="property-detail-layout"><article className="property-detail-main"><div className="property-heading"><div className="property-labels"><span><T id={purposeLabel(listing.purpose)}/></span><span><T id={typeLabel(listing.propertyType)}/></span>{listing.source==='demo'&&<span className="sample"><T id="Örnek ilan"/></span>}{listing.ownerVerified&&<VerifiedBadge/>}</div><h1><PropertyText listing={listing} field="title"/></h1><p><MapPin size={18}/>{listing.postalCode?`${listing.postalCode} `:''}{listing.city}, {listing.district}{listing.neighborhood?`, ${listing.neighborhood}`:''}</p></div>
    <ListingDates publishedAt={listing.publishedAt} updatedAt={listing.updatedAt}/>
    <div className="property-key-facts"><div className="property-main-price"><strong><Money value={listing.price} currency={listing.currency}/>{pricePeriod(listing.purpose)&&<small> <T id={pricePeriod(listing.purpose)}/></small>}</strong>{history?.drop&&<PriceDropNote drop={history.drop} currency={listing.currency}/>}<span>{listing.grossArea>0&&<><Money value={listing.price/listing.grossArea} currency={listing.currency} fractionDigits={2}/> / m²{pricePeriod(listing.purpose)&&<> <T id={pricePeriod(listing.purpose)}/></>}</>}</span><div className="property-price-convert"><ApproxPrice value={listing.price} currency={listing.currency}/><CurrencySelect/></div></div>{listing.rooms&&<div><strong>{listing.rooms}</strong><span><T id="Oda düzeni"/></span></div>}<div><strong>{listing.netArea||listing.grossArea} m²</strong><span><T id={listing.netArea?'Net alan':'Brüt alan'}/></span></div></div>
    {history&&<PriceHistoryPanel history={history}/>}
    {listing.amenities.length>0&&<div className="property-amenity-tags">{listing.amenities.slice(0,4).map(a=><span key={a}><T id={a}/></span>)}</div>}
    <section className="property-section"><h2><T id="Gayrimenkul bilgileri"/></h2><dl className="property-facts-grid">{facts.map(([label,value])=><div key={label}><dt><T id={label}/></dt><dd>{value}</dd></div>)}</dl>{foreignSale==="Evet"&&<aside className="property-foreign-note"><Globe2 size={20} aria-hidden="true"/><div><strong><T id="Bu ilan, ilan verenin beyanına göre yabancılara satışa uygundur."/></strong><p><T id="Satın almadan önce uygunluğu tapu müdürlüğünden ve bağımsız bir avukattan teyit edin."/></p><div className="property-foreign-links"><Link href={FOREIGN_BUYER_PATH}><T id="Yabancı alıcılar için rehber"/><ArrowRight size={15}/></Link><Link href={CITIZENSHIP_PATH}><T id="Yatırım yoluyla vatandaşlık"/><ArrowRight size={15}/></Link></div></div></aside>}</section>
    <section className="property-section"><h2><T id="İlan açıklaması"/></h2><p className="property-description"><PropertyText listing={listing} field="description"/></p>{listing.source==='demo'&&<p className="property-example-note"><T id="Bu ilan patron sunumu için hazırlanmış örnek içeriktir. Konum, fiyat ve fotoğraflar gerçek bir satış teklifini temsil etmez."/></p>}</section>
    {listing.amenities.length>0&&<section className="property-section"><h2><T id="Öne çıkan imkânlar"/></h2><div className="property-amenities">{listing.amenities.map(a=><span key={a}><Check size={16}/><T id={a}/></span>)}</div></section>}
    <PropertyPresentation value={listing.presentation} video={video}/>
    <BuyerTools listing={listing}/>
    <ServiceSuggestions city={listing.city} purpose={listing.purpose} foreignSale={foreignSale==="Evet"}/>
    {(authorityNumber||eids)&&<section className="property-section property-legal"><h2><T id="Yasal bilgiler"/></h2><dl className="property-facts-grid">{authorityNumber&&<div><dt><T id="Taşınmaz ticareti yetki belgesi no"/></dt><dd>{authorityNumber}</dd></div>}{eids&&<div><dt><T id="EİDS doğrulama no (ilan verenin beyanı)"/></dt><dd>{eids}</dd></div>}</dl></section>}
    {map&&<section className="property-section"><h2><T id="Konum"/></h2><ExternalMap title={translate("{name} haritası",locale).replace("{name}",listing.district)} src={map}/><p className="property-map-note"><MapPin size={14}/><T id="Haritadaki nokta yaklaşık konumu gösterir."/></p></section>}
    </article><aside className="property-detail-aside"><ContactCard listing={listing}/></aside></div>
    <SimilarListings listings={similar} href={similarSearchHref(listing)}/>
    <div className="property-detail-back"><Link href="/ilanlar"><ArrowLeft size={16}/><T id="Tüm ilanlara dön"/></Link></div>
  </div></main>;
}
