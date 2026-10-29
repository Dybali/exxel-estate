"use client";
import {useLocale} from "@/lib/i18n";
import {LAND_CREDIT,LAND_DEED,LAND_SWAP,LAND_ZONING,type LandField} from "@/lib/land";

// Land inputs for the post and edit forms. Controlled when onChange is given, otherwise
// uncontrolled form fields (name + defaultValue) read with FormData.
export function LandFields({values,onChange}:{values:Partial<Record<LandField,string>>;onChange?:(key:LandField,value:string)=>void}){
 const {t}=useLocale();
 const bind=(key:LandField)=>onChange?{name:key,value:values[key]||"",onChange:(e:{target:{value:string}})=>onChange(key,e.target.value)}:{name:key,defaultValue:values[key]||""};
 const select=(key:LandField,label:string,options:readonly string[])=><label>{t(label)}<select {...bind(key)}><option value="">{t("Belirtilmemiş")}</option>{options.map(o=><option key={o} value={o}>{t(o)}</option>)}</select></label>;
 const text=(key:LandField,label:string,extra:Record<string,string>={})=><label>{t(label)}<input {...bind(key)} maxLength={20} {...extra}/></label>;
 return <>
  {select("landZoning","İmar Durumu",LAND_ZONING)}
  {text("landBlock","Ada No")}{text("landParcel","Parsel No")}{text("landSheet","Pafta No")}
  {text("landKaks","Kaks (Emsal)",{inputMode:"decimal",placeholder:"1.50"})}{text("landGabari","Gabari",{placeholder:"6.50"})}
  {select("landCredit","Krediye Uygunluk",LAND_CREDIT)}{select("landDeed","Tapu Durumu",LAND_DEED)}{select("landSwap","Takas",LAND_SWAP)}
 </>;
}
