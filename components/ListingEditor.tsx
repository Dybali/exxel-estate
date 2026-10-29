"use client";
import {apiJson} from '@/lib/api-client';


import {PURPOSES,purposeLabel,pricePeriod} from "@/lib/property-categories";
import {checkListingPhoto} from '@/lib/photo-quality';
import {optimizeListingPhoto} from '@/lib/photo-optimize';
import {PresentationFields} from "./PropertyPresentation";
import {PhotoManager} from "./PhotoManager";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, ArrowRight, CloudUpload, X } from "lucide-react";
import { useLocale, locales } from "@/lib/i18n";
import { AMENITIES, CITIES, PROPERTY_TYPES, type Listing } from "@/lib/listings";
import { districtsFor } from "@/lib/turkey-locations";

type Neighborhood = {id:number;name:string;postalCode:string;label:string};
type Profile = {id:string;role:string;agent_status:string;isAdmin?:boolean};

export function ListingEditor({id}:{id:string}) {
  const {t}=useLocale();
  const [listing,setListing]=useState<Listing|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [city,setCity]=useState("");
  const [district,setDistrict]=useState("");
  const [neighborhoodId,setNeighborhoodId]=useState("");
  const [neighborhoods,setNeighborhoods]=useState<Neighborhood[]>([]);
  const [presentation,setPresentation]=useState<Record<string,string>>({});
  const [images,setImages]=useState<string[]>([]);
  const [amenities,setAmenities]=useState<string[]>([]);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([
      fetch(`/api/listings/${encodeURIComponent(id)}`,{signal:controller.signal,cache:"no-store"}).then(async response=>response.ok?response.json():null),
      fetch("/api/account",{signal:controller.signal,cache:"no-store"}).then(response=>response.json()),
    ]).then(([record,account])=>{
      if(controller.signal.aborted)return;
      const item=(record as {listing?:Listing}|null)?.listing||null;
      const user=(account as {user?:Profile}).user||null;
      setListing(item);setProfile(user);
      if(item){setCity(item.city);setDistrict(item.district);setNeighborhoodId(String(item.neighborhoodId||""));setImages(item.images);setPresentation({floorPlan:item.presentation?.floorPlan||'',videoUrl:item.presentation?.videoUrl||'',tourUrl:item.presentation?.tourUrl||'',panoramas:JSON.stringify(item.presentation?.panoramas||[]),eidsNumber:item.presentation?.eidsNumber||''});setAmenities(item.amenities);}
    }).catch(()=>{if(!controller.signal.aborted)setError("İlan bilgileri yüklenemedi.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[id]);

  useEffect(()=>{
    if(!city||!district){setNeighborhoods([]);return;}
    const controller=new AbortController();
    fetch(`/api/locations?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`,{signal:controller.signal})
      .then(async response=>response.ok?apiJson<{neighborhoods?:Neighborhood[]}>(response):{neighborhoods:[]})
      .then((data:{neighborhoods?:Neighborhood[]})=>{if(!controller.signal.aborted)setNeighborhoods(data.neighborhoods||[]);})
      .catch(()=>{if(!controller.signal.aborted)setNeighborhoods([]);});
    return()=>controller.abort();
  },[city,district]);

  async function upload(files:FileList|null,target='photos'){
    if(!files||uploading||saving)return;
    setUploading(true);setError("");
    for(const file of Array.from(files).slice(0,target==='floorPlan'?1:30-images.length)){
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>40000000){setError("JPG, PNG veya WEBP; en fazla 8 MB.");continue;}
      try{if(target==="photos")await checkListingPhoto(file);const prepared=await optimizeListingPhoto(file,{watermark:target==="photos"}).catch(()=>file);if(prepared.size>8000000)throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");const form=new FormData();form.append("file",prepared);const response=await fetch("/api/media",{method:"POST",body:form});const data=await response.json() as {url?:string;error?:string};if(!response.ok||!data.url)throw new Error(data.error||"Fotoğraf yüklenemedi.");if(target==='floorPlan')setPresentation(old=>({...old,floorPlan:data.url!}));else setImages((old)=>[...old,data.url!]);}
      catch(cause){setError(cause instanceof Error?cause.message:"Fotoğraf yüklenemedi.");}
    }
    setUploading(false);
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!listing||saving||uploading)return;
    if(images.length===0){setError("En az bir fotoğraf ekleyin.");return;}
    const form=new FormData(event.currentTarget);
    const translations:Record<string,{title:string;description:string}>={};
    for(const {code} of locales){if(code==="tr")continue;const title=String(form.get(`title_${code}`)||"").trim(),description=String(form.get(`description_${code}`)||"").trim();if(title||description)translations[code]={title,description};}
    const payload={...presentation,title:form.get("title"),description:form.get("description"),purpose:form.get("purpose"),propertyType:form.get("propertyType"),price:form.get("price"),currency:form.get("currency"),city,district,neighborhoodId, gardenArea:form.get("gardenArea"),plotArea:form.get("plotArea"),grossArea:form.get("grossArea"),netArea:form.get("netArea"),rooms:form.get("rooms"),bedrooms:form.get("bedrooms"),bathrooms:form.get("bathrooms"),buildingAge:form.get("buildingAge"),floor:form.get("floor"),totalFloors:form.get("totalFloors"),heating:form.get("heating"),furnished:form.get("furnished")==="1",amenities,images,translations,expectedUpdatedAt:listing.updatedAt};
    setSaving(true);setError("");
    try{const response=await fetch(`/api/listings/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||"İlan güncellenemedi.");window.location.assign("/hesabim?tab=ilanlarim");}
    catch(cause){setError(cause instanceof Error?cause.message:"İlan güncellenemedi.");setSaving(false);}
  }

  if(loading)return <main className="form-page"><div className="container section">{t("İlan yükleniyor…")}</div></main>;
  if(!listing||!profile||listing.source!=="user"||listing.ownerId!==profile.id&&!profile.isAdmin)return <main className="form-page"><div className="container form-gate"><h1>{t("İlan düzenlenemiyor.")}</h1><p>{t("İlanı düzenlemek için ilan sahibi hesabınızla giriş yapın.")}</p><Link className="primary-button" href="/hesabim?tab=ilanlarim">{t("İlanlarıma dön")} <ArrowRight size={17}/></Link></div></main>;
  const direct=(profile.role==="agent"&&profile.agent_status==="approved"||profile.isAdmin)&&listing.status==="published";
  return <main className="form-page listing-editor-page">
    <div className="form-hero"><div className="container"><Link className="company-back" href="/hesabim?tab=ilanlarim"><ArrowLeft size={16}/> {t("İlanlarıma dön")}</Link><span className="eyebrow dark-eyebrow">ESTATEMARKET24 · {t("İLAN YÖNETİMİ")}</span><h1>{t("İlanı düzenle")}</h1><p>{t("Değişiklikleri kaydettikten sonra ilan durumunu hesabınızdan takip edebilirsiniz.")}</p></div></div>
    <nav className="container listing-step-nav" aria-label={t("İlan düzenleme adımları")}><a href="#edit-basics"><span>01</span>{t("Temel bilgiler")}</a><a href="#edit-location"><span>02</span>{t("Konum")}</a><a href="#edit-features"><span>03</span>{t("Özellikler")}</a><a href="#edit-images"><span>04</span>{t("Fotoğraflar")}</a></nav>
    <div className="container form-layout"><form onSubmit={submit} className="property-form">
      <section id="edit-basics"><span className="form-section-no">01</span><h2>{t("Temel bilgiler")}</h2><p>{t("Başlık, açıklama ve fiyatı güncelleyin.")}</p><div className="form-grid">
        <label>{t("İlan türü")}<select name="purpose" defaultValue={listing.purpose}>{PURPOSES.map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
        <label>{t("Gayrimenkul tipi")}<select name="propertyType" defaultValue={listing.propertyType}>{PROPERTY_TYPES.map((item)=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
        <label className="span-2">{t("İlan başlığı")}<input name="title" required minLength={12} maxLength={150} defaultValue={listing.title}/></label>
        <label className="span-2">{t("Açıklama")}<textarea name="description" required minLength={30} maxLength={5000} rows={6} defaultValue={listing.description}/></label>
        <label>{t("Fiyat")}<input name="price" type="number" required min="1" step="1" defaultValue={listing.price}/></label>
        <label>{t("Para birimi")}<select name="currency" defaultValue={listing.currency}>{["TRY","EUR","USD","GBP"].map((item)=><option key={item}>{item}</option>)}</select></label>
        <details className="translation-fields span-2"><summary>{t("İlan metninin çevirileri")}</summary><p>{t("Mevcut çevirileri güncelleyebilir veya boşaltabilirsiniz.")}</p>{locales.filter((item)=>item.code!=="tr").map((item)=><div className="translation-language" key={item.code}><strong>{item.label}</strong><label>{t("İlan başlığı")}<input name={`title_${item.code}`} minLength={12} maxLength={150} defaultValue={listing.translations?.[item.code as keyof NonNullable<Listing["translations"]>]?.title||""}/></label><label>{t("Açıklama")}<textarea name={`description_${item.code}`} minLength={30} maxLength={5000} rows={3} defaultValue={listing.translations?.[item.code as keyof NonNullable<Listing["translations"]>]?.description||""}/></label></div>)}</details>
      </div></section>
      <section id="edit-location"><span className="form-section-no">02</span><h2>{t("Konum")}</h2><p>{t("İl, ilçe ve mahalleyi doğrulayın.")}</p><div className="form-grid"><label>{t("Şehir")}<select value={city} onChange={(event)=>{setCity(event.target.value);setDistrict("");setNeighborhoodId("");}} required><option value="">{t("Şehir seçin")}</option>{CITIES.map((item)=><option key={item}>{item}</option>)}</select></label><label>{t("İlçe")}<select value={district} onChange={(event)=>{setDistrict(event.target.value);setNeighborhoodId("");}} required disabled={!city}><option value="">{t("İlçe seçin")}</option>{districtsFor(city).map((item)=><option key={item}>{item}</option>)}</select></label><label className="span-2">{t("Mahalle")}<select value={neighborhoodId} onChange={(event)=>setNeighborhoodId(event.target.value)} required disabled={!district}><option value="">{t("Mahalle seçin")}</option>{neighborhoods.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div></section>
      <section id="edit-features"><span className="form-section-no">03</span><h2>{t("Özellikler")}</h2><p>{t("Ölçüleri ve imkânları güncel tutun.")}</p><div className="form-grid"><label>{t("Brüt alan (m²)")}<input name="grossArea" type="number" min="1" required defaultValue={listing.grossArea}/></label><label>{t("Net alan (m²)")}<input name="netArea" type="number" min="0" defaultValue={listing.netArea??""}/></label><label>{t("Arsa alanı (m²)")}<input name="plotArea" type="number" min="0" defaultValue={listing.presentation?.plotArea??""}/></label><label>{t("Bahçe alanı (m²)")}<input name="gardenArea" type="number" min="0" defaultValue={listing.presentation?.gardenArea??""}/></label><label>{t("Oda düzeni")}<select name="rooms" defaultValue={listing.rooms||""}><option value="">{t("Seçin")}</option>{["1+0","1+1","2+1","3+1","4+1","5+1","6+1"].map((item)=><option key={item}>{item}</option>)}</select></label><label>{t("Yatak odası")}<input name="bedrooms" type="number" min="0" defaultValue={listing.bedrooms??""}/></label><label>{t("Banyo sayısı")}<input name="bathrooms" type="number" min="0" defaultValue={listing.bathrooms??""}/></label><label>{t("Bina yaşı")}<input name="buildingAge" type="number" min="0" defaultValue={listing.buildingAge??""}/></label><label>{t("Bulunduğu kat")}<input name="floor" type="number" min="0" defaultValue={listing.floor??""}/></label><label>{t("Toplam kat")}<input name="totalFloors" type="number" min="0" defaultValue={listing.totalFloors??""}/></label><label>{t("Isıtma")}<select name="heating" defaultValue={listing.heating||""}><option value="">{t("Seçin")}</option>{["Kombi","Merkezi","Yerden ısıtma","Klima","Soba"].map((item)=><option key={item} value={item}>{t(item)}</option>)}</select></label><label>{t("Eşyalı")}<select name="furnished" defaultValue={listing.furnished?"1":""}><option value="">{t("Hayır")}</option><option value="1">{t("Evet")}</option></select></label></div><div className="form-amenities"><strong>{t("İmkanlar")}</strong><div>{AMENITIES.map((item)=><label key={item}><input type="checkbox" checked={amenities.includes(item)} onChange={(event)=>setAmenities(event.target.checked?[...amenities,item]:amenities.filter((value)=>value!==item))}/>{t(item)}</label>)}</div></div></section>
      <PresentationFields fields={presentation} onChange={(key,value)=>setPresentation(old=>({...old,[key]:value}))} onUpload={file=>{const transfer=new DataTransfer();transfer.items.add(file);void upload(transfer.files,'floorPlan');}} uploading={uploading} onBusyChange={setUploading}/>
      <section id="edit-images"><span className="form-section-no">04</span><h2>{t("Fotoğraflar")}</h2><p>{t("Fotoğrafları sürükleyin veya oklarla sıralayın. Yıldız ile kapak seçin.")}</p><p className="upload-privacy-note">{t("Fotoğraflar yüklenirken küçültülür, WebP biçimine çevrilir ve estatemarket24 filigranı eklenir. Konum gibi gizli dosya bilgileri silinir.")}</p><label className="upload-zone"><CloudUpload size={30}/><strong>{t(uploading?"Fotoğraflar yükleniyor...":"Yeni fotoğraf ekle")}</strong><span>{t("JPG, PNG veya WEBP · En fazla 30 fotoğraf")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event)=>upload(event.target.files)} disabled={uploading}/></label><PhotoManager images={images} onChange={setImages} disabled={uploading||saving}/></section>
      {error&&<p className="form-error" role="alert">{t(error)}</p>}<button className="primary-button form-submit" disabled={saving||uploading}>{t(saving?"Kaydediliyor...":"Değişiklikleri kaydet")}<ArrowRight size={18}/></button><p className="submit-note">{t(direct?"Onaylı emlakçı değişiklikleri doğrudan yayımlanır.":"Değişiklikler yönetici onayından sonra yayımlanır.")}</p>
    </form><aside className="form-help"><div><span className="eyebrow light-eyebrow">{t("İLAN DÜZENLEME")}</span><h3>{t("Güncel bilgi güven verir.")}</h3><p>{t("Fiyatı, fotoğrafları ve açıklamayı gerçeğe uygun tutun. İlanınızın güncel durumunu hesabınızdan görebilirsiniz.")}</p></div></aside></div>
  </main>;
}
