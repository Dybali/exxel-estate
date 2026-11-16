"use client";
import { useLocale } from "@/lib/i18n";
import type { Listing } from "@/lib/listings";
import {useContentTranslation,TranslationNotice} from './ContentTranslation';
import {listingLanguage} from '@/lib/listing-language';
import type {StoredTranslation} from '@/lib/translation-stored';

// `initial`: the saved machine translation the server rendered for this language (app/ilan/[id]/page.tsx), if any.
export function PropertyText({ listing, field, initial }: { listing: Listing; field: "title" | "description"; initial?: StoredTranslation | null }) {
  const { locale } = useLocale();
  // Readers in the listing's own language see the original; others the owner's translation, else the machine (Gemini) translation.
  const source=listingLanguage(listing);
  const translated=useContentTranslation('listing',listing.id,{title:listing.title,description:listing.description},source,initial);
  const manual=locale!==source&&locale!=='tr'?listing.translations?.[locale]?.[field]:undefined;
  const text = locale === source ? listing[field] : manual || translated.fields[field] || listing[field];
  return <>{text}{field==='description'&&<TranslationNotice machine={!manual&&translated.machine} hasTranslation={Boolean(manual||translated.fields[field])} sourceLanguage={source}/>}</>;
}
