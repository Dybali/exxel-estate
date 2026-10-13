"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { CITIES, PROPERTY_TYPES } from "@/lib/listings";
export function HomeSearch(){
  const router=useRouter();const [purpose,setPurpose]=useState("satilik"),[city,setCity]=useState(""),[type,setType]=useState("");
  const submit=()=>{const query=new URLSearchParams();query.set("purpose",purpose);if(city)query.set("city",city);if(type)query.set("type",type);router.push(`/ilanlar?${query}`);};
  return <div className="home-search"><div className="home-search-tabs"><button className={purpose==="satilik"?"active":""} onClick={()=>setPurpose("satilik")}>Satılık</button><button className={purpose==="kiralik"?"active":""} onClick={()=>setPurpose("kiralik")}>Kiralık</button><span className="search-caption">HAYALİNİZDEKİ YERİ BULUN</span></div><div className="home-search-fields"><label><span>Konum</span><div><MapPin size={20}/><select value={city} onChange={(e)=>setCity(e.target.value)} aria-label="Şehir"><option value="">Tüm şehirler</option>{CITIES.map((item)=><option key={item}>{item}</option>)}</select></div></label><label><span>Gayrimenkul tipi</span><div><SlidersHorizontal size={19}/><select value={type} onChange={(e)=>setType(e.target.value)} aria-label="Gayrimenkul tipi"><option value="">Tüm tipler</option>{PROPERTY_TYPES.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div></label><button className="home-search-submit" onClick={submit}>İlan ara <Search size={19}/></button></div></div>;
}

