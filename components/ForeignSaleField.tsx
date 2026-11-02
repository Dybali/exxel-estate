"use client";
import Link from "@/components/SafeLink";
import {useLocale} from "@/lib/i18n";
import {FOREIGN_SALE,foreignSaleApplies} from "@/lib/listing-details";
import {FOREIGN_BUYER_PATH} from "@/lib/citizenship-guide";

// "Yabancıya satışa uygun" select for the post and edit forms; only for sale listings. Controlled
// when onChange is given, otherwise an uncontrolled field read with FormData.
export function ForeignSaleField({purpose,propertyType,value,onChange}:{purpose:string;propertyType:string;value:string;onChange?:(value:string)=>void}){
 const {t}=useLocale();
 if(!foreignSaleApplies(purpose,propertyType))return null;
 const bind=onChange?{value,onChange:(event:{target:{value:string}})=>onChange(event.target.value)}:{defaultValue:value};
 return <div className="foreign-sale-field span-2"><label>{t(FOREIGN_SALE.label)}<select name={FOREIGN_SALE.form} {...bind}><option value="">{t("Belirtilmemiş")}</option>{FOREIGN_SALE.options.map(option=><option key={option} value={option}>{t(option)}</option>)}</select></label><p>{t("Taşınmazın yabancıların edinimine açık olup olmadığını (askerî veya güvenlik bölgesi, ilçe sınırı) tapu müdürlüğünden teyit ederek işaretleyin. Bu bilgi ilan verenin beyanıdır.")} <Link href={FOREIGN_BUYER_PATH} target="_blank" rel="noopener">{t("Yabancı alıcılar için rehber")}</Link></p></div>;
}
