import Link from "@/components/SafeLink";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, MapPin } from "lucide-react";
import { typeLabel } from "@/lib/listings";
import { listingById } from "@/lib/server";
import type { Metadata } from "next";
import { ContactCard } from "@/components/ContactCard";
import { T, Money } from "@/lib/i18n";
import { ListingGallery } from "@/components/ListingGallery";
import { PropertyText } from "@/components/PropertyText";
export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params, listing=await listingById(id);
  if(!listing || listing.source==='user'&&listing.status!=='published')return {title:'İlan bulunamadı | estatemarket24'};
  return {title:`${listing.title} | estatemarket24`,description:listing.description.slice(0,155),openGraph:{title:listing.title,description:listing.description.slice(0,155),images:listing.images[0]?[listing.images[0]]:[]}};
}
export default async function Detail({params}:{params:Promise<{id:string}>}) {
  const {id}=await params,listing=await listingById(id);
  if(!listing||listing.status&&listing.status!=='published'&&listing.source!=='demo')notFound();
  const map=listing.latitude!=null&&listing.longitude!=null?`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude-.012}%2C${listing.latitude-.009}%2C${listing.longitude+.012}%2C${listing.latitude+.009}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`:null;
  const facts:[string,React.ReactNode][]=[['İlan türü',<T key="purpose" id={listing.purpose==='satilik'?'Satılık':'Kiralık'}/>],['Gayrimenkul tipi',<T key="type" id={typeLabel(listing.propertyType)}/>],['Brüt alan',`${listing.grossArea} m²`]];
  if(listing.netArea)facts.push(['Net alan',`${listing.netArea} m²`]);if(listing.rooms)facts.push(['Oda düzeni',listing.rooms]);if(listing.bedrooms!=null)facts.push(['Yatak odası',listing.bedrooms]);if(listing.bathrooms!=null)facts.push(['Banyo',listing.bathrooms]);if(listing.buildingAge!=null)facts.push(['Bina yaşı',listing.buildingAge===0?<T key="new" id="Yeni"/>:listing.buildingAge]);if(listing.floor!=null)facts.push(['Bulunduğu kat',listing.floor]);if(listing.totalFloors!=null)facts.push(['Kat sayısı',listing.totalFloors]);if(listing.heating)facts.push(['Isıtma',listing.heating]);facts.push(['Eşyalı',<T key="furnished" id={listing.furnished?'Evet':'Hayır'}/>]);
  return <main className="property-detail-page"><div className="container">
    <nav className="property-breadcrumb" aria-label="Sayfa konumu"><Link href="/ilanlar"><ArrowLeft size={15}/><T id="İlanlar"/></Link><ChevronRight size={13}/><Link href={`/ilanlar?city=${encodeURIComponent(listing.city)}`}>{listing.city}</Link><ChevronRight size={13}/><span>{listing.district}</span></nav>
    <ListingGallery listingId={listing.id} images={listing.images} title={listing.title}/>
    <div className="property-detail-layout"><article className="property-detail-main"><div className="property-heading"><div className="property-labels"><span><T id={listing.purpose==='satilik'?'Satılık':'Kiralık'}/></span><span><T id={typeLabel(listing.propertyType)}/></span>{listing.source==='demo'&&<span className="sample">Örnek ilan</span>}</div><h1><PropertyText listing={listing} field="title"/></h1><p><MapPin size={18}/>{listing.postalCode?`${listing.postalCode} `:''}{listing.city}, {listing.district}{listing.neighborhood?`, ${listing.neighborhood}`:''}</p></div>
    <div className="property-key-facts"><div className="property-main-price"><strong><Money value={listing.price} currency={listing.currency}/>{listing.purpose==='kiralik'&&<small> / ay</small>}</strong><span>{listing.grossArea>0&&<><Money value={listing.price/listing.grossArea} currency={listing.currency}/> / m²{listing.purpose==='kiralik'?' / ay':''}</>}</span></div>{listing.rooms&&<div><strong>{listing.rooms}</strong><span><T id="Oda düzeni"/></span></div>}<div><strong>{listing.netArea||listing.grossArea} m²</strong><span><T id={listing.netArea?'Net alan':'Brüt alan'}/></span></div></div>
    {listing.amenities.length>0&&<div className="property-amenity-tags">{listing.amenities.slice(0,4).map(a=><span key={a}><T id={a}/></span>)}</div>}
    <section className="property-section"><h2><T id="Gayrimenkul bilgileri"/></h2><dl className="property-facts-grid">{facts.map(([label,value])=><div key={label}><dt><T id={label}/></dt><dd>{value}</dd></div>)}</dl></section>
    <section className="property-section"><h2><T id="İlan açıklaması"/></h2><p className="property-description"><PropertyText listing={listing} field="description"/></p>{listing.source==='demo'&&<p className="property-example-note"><T id="Bu ilan patron sunumu için hazırlanmış örnek içeriktir. Konum, fiyat ve fotoğraflar gerçek bir satış teklifini temsil etmez."/></p>}</section>
    {listing.amenities.length>0&&<section className="property-section"><h2><T id="Öne çıkan imkânlar"/></h2><div className="property-amenities">{listing.amenities.map(a=><span key={a}><Check size={16}/><T id={a}/></span>)}</div></section>}
    {map&&<section className="property-section"><h2><T id="Konum"/></h2><div className="property-location-map"><iframe title={`${listing.district} haritası`} src={map} loading="lazy"/></div><p className="property-map-note"><MapPin size={14}/><T id="Haritadaki nokta yaklaşık konumu gösterir."/></p></section>}
    </article><aside className="property-detail-aside"><ContactCard listing={listing}/></aside></div>
    <div className="property-detail-back"><Link href="/ilanlar"><ArrowLeft size={16}/><T id="Tüm ilanlara dön"/></Link></div>
  </div></main>;
}
