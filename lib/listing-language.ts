// The language a listing's title and description are written in. Owners abroad (e.g. in Germany) write
// in their own language; everyone else reads a translation, Turkish visitors included. Stored as
// `presentation.language` (absent = Turkish, as for every listing before this was added).
export const LISTING_LANGUAGES = ["tr", "de", "fr", "en", "ar", "fa", "ru", "nl"] as const;
export type ListingLanguage = typeof LISTING_LANGUAGES[number];
export const isListingLanguage = (value: unknown): value is ListingLanguage => (LISTING_LANGUAGES as readonly unknown[]).includes(value);
export const listingLanguage = (listing: { presentation?: { language?: string } | null } | null | undefined): ListingLanguage =>
  isListingLanguage(listing?.presentation?.language) ? listing!.presentation!.language as ListingLanguage : "tr";
/** Languages a listing is translated into: every site language except the one it is written in. */
export const listingTranslationTargets = (source: ListingLanguage) => LISTING_LANGUAGES.filter((code) => code !== source);
