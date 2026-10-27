"use client";
import { useLocale } from "@/lib/i18n";
import type { Listing } from "@/lib/listings";
import {useContentTranslation,TranslationNotice} from './ContentTranslation';

export function PropertyText({ listing, field }: { listing: Listing; field: "title" | "description" }) {
  const { locale } = useLocale();
  const translated=useContentTranslation('listing',listing.id,{title:listing.title,description:listing.description});
  const manual=locale!=='tr'?listing.translations?.[locale]?.[field]:undefined;
  const text = locale === "tr" ? listing[field] : manual || translated.fields[field] || listing[field];
  return <>{text}{field==='description'&&<TranslationNotice machine={!manual&&translated.machine} hasTranslation={Boolean(manual||translated.fields[field])}/>}</>;
}
