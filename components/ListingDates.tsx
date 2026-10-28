"use client";
import {CalendarDays,RefreshCw} from 'lucide-react';
import {useLocale} from '@/lib/i18n';
export function ListingDates({publishedAt,updatedAt}:{publishedAt?:string;updatedAt?:string}){
 const {locale,t}=useLocale();
 const date=(value?:string)=>{if(!value||!Number.isFinite(Date.parse(value)))return null;return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));};
 const published=date(publishedAt),updated=date(updatedAt);if(!published&&!updated)return null;
 return <div className="listing-trust-dates">{published&&<span><CalendarDays size={15}/>{t('Yayın tarihi')}: <time dateTime={publishedAt}>{published}</time></span>}{updated&&<span><RefreshCw size={15}/>{t('Son güncelleme')}: <time dateTime={updatedAt}>{updated}</time></span>}</div>;
}
