import type { Locale } from "./i18n-dictionary";
import type { Listing } from "./listings";
import { localizedUrl, siteUrl } from "./request-context";

export function localizedListingText(listing: Listing, locale: Locale) {
  const manual = locale === "tr" ? undefined : listing.translations?.[locale];
  return { title: manual?.title || listing.title, description: manual?.description || listing.description, locale: manual ? locale : "tr" as Locale };
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
    ...(listing.publishedAt ? { datePosted: listing.publishedAt } : {}),
    ...(listing.images.length ? { image: listing.images.slice(0, 10).map(absolute) } : {}),
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      businessFunction: listing.purpose === "satilik" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
      availability: "https://schema.org/InStock",
      ...(listing.ownerName ? { seller: { "@type": "RealEstateAgent", name: listing.ownerName } } : {}),
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
