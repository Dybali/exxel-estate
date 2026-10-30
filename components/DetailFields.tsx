"use client";
import {useLocale} from "@/lib/i18n";
import {categoryOfType,detailsFor,type DetailForm} from "@/lib/listing-details";

// Detail selects for the post and edit forms, limited to the property's category. Controlled
// when onChange is given, otherwise uncontrolled form fields read with FormData.
export function DetailFields({propertyType,values,onChange}:{propertyType:string;values:Partial<Record<DetailForm,string>>;onChange?:(key:DetailForm,value:string)=>void}){
 const {t}=useLocale();
 return <>{detailsFor(categoryOfType(propertyType)).map(field=>{
  const bind=onChange?{value:values[field.form]||"",onChange:(e:{target:{value:string}})=>onChange(field.form,e.target.value)}:{defaultValue:values[field.form]||""};
  return <label key={field.form}>{t(field.label)}<select name={field.form} {...bind}><option value="">{t("Belirtilmemiş")}</option>{field.options.map(o=><option key={o} value={o}>{t(o)}</option>)}</select></label>;
 })}</>;
}
