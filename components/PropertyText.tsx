"use client";
import { useLocale } from "@/lib/i18n";
import type { Listing } from "@/lib/listings";

export function PropertyText({ listing, field }: { listing: Listing; field: "title" | "description" }) {
  const { locale } = useLocale();
  const text = locale === "tr" ? listing[field] : listing.translations?.[locale]?.[field] || listing[field];
  return <>{text}</>;
}
