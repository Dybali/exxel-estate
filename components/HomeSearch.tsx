"use client";
import { useState } from "react";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { CITIES, PROPERTY_TYPES } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";
export function HomeSearch(){
  const {t}=useLocale();const [purpose,setPurpose]=useState("satilik"),[city,setCity]=useState(""),[type,setType]=useState("");
  const submit=()=>{const query=new URLSearchParams();query.set("purpose",purpose);if(city)query.set("city",city);if(type)query.set("type",type);window.location.assign(`/ilanlar?${query}`);};
  return <div className="home-search"><div className="home-search-tabs"><button className={purpose==="satilik"?"active":""} onClick={()=>setPurpose("satilik")}>{t("Satılık")}</button><button className={purpose==="kiralik"?"active":""} onClick={()=>setPurpose("kiralik")}>{t("Kiralık")}</button><span className="search-caption">{t("HAYALİNİZDEKİ YERİ BULUN")}</span></div><div className="home-search-fields"><label><span>{t("Konum")}</span><div><MapPin size={20}/><select value={city} onChange={(e)=>setCity(e.target.value)} aria-label={t("Şehir")}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((item)=><option key={item}>{item}</option>)}</select></div></label><label><span>{t("Gayrimenkul tipi")}</span><div><SlidersHorizontal size={19}/><select value={type} onChange={(e)=>setType(e.target.value)} aria-label={t("Gayrimenkul tipi")}><option value="">{t("Tüm tipler")}</option>{PROPERTY_TYPES.map((item)=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></div></label><button className="home-search-submit" onClick={submit}>{t("İlan ara")} <Search size={19}/></button></div></div>;
}

