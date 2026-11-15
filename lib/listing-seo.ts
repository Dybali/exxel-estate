import type { Locale } from "./i18n-dictionary";
import { listingLanguage } from "./listing-language";
import type { Listing } from "./listings";
import { localizedUrl, siteUrl } from "./request-context";

// The owner's own translation for the page language, else the text as written. `locale` is the language
// of the returned text: the listing's source language (lib/listing-language.ts) unless a translation is used.
export function localizedListingText(listing: Listing, locale: Locale) {
  const source = listingLanguage(listing) as Locale;
  const manual = locale === "tr" || locale === source ? undefined : listing.translations?.[locale];
  return { title: manual?.title || listing.title, description: manual?.description || listing.description, locale: manual ? locale : source };
}

/** ISO 8601 for a stored timestamp such as "2026-11-11 13:22:11.846189+00"; undefined when unreadable. */
export function isoDate(value: string | null | undefined) {
  if (!value) return undefined;
  const time = [value, value.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")].map(Date.parse).find(Number.isFinite);
  return time === undefined ? undefined : new Date(time).toISOString();
}

const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : siteUrl() + path);

// schema.org RealEstateListing so search engines can show price, place and photos.
export function listingStructuredData(listing: Listing, text: { title: string; description: string; locale: Locale }) {
  const url = localizedUrl(`/ilan/${listing.id}`, text.locale);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: text.title,
    description: text.description.slice(0, 5000),
    inLanguage: text.locale,
    ...(isoDate(listing.publishedAt) ? { datePosted: isoDate(listing.publishedAt) } : {}),
    ...(listing.images.length ? { image: listing.images.slice(0, 10).map(absolute) } : {}),
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      businessFunction: listing.purpose === "satilik" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
      availability: "https://schema.org/InStock",
      // Offices are estate agents; private owners (Sahibinden) are people.
      ...(listing.ownerName ? { seller: { "@type": listing.ownerRole === "agent" ? "RealEstateAgent" : "Person", name: listing.ownerName } } : {}),
    },
    about: {
      "@type": "Accommodation",
      floorSize: { "@type": "QuantitativeValue", value: listing.netArea || listing.grossArea, unitCode: "MTK" },
      ...(listing.bedrooms != null ? { numberOfBedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms != null ? { numberOfBathroomsTotal: listing.bathrooms } : {}),
      address: {
        "@type": "PostalAddress",
        addressCountry: "TR",
        addressRegion: listing.city,
        addressLocality: listing.district,
        ...(listing.postalCode ? { postalCode: listing.postalCode } : {}),
      },
    },
  };
}
