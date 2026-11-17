// The site's languages, without any translations: safe to import anywhere, including the browser bundle.
export type Locale = "tr" | "de" | "fr" | "en" | "ar" | "fa" | "ru" | "nl";
export const locales: { code: Locale; label: string; flag: string }[] = [
  { code: "tr", label: "Türkçe", flag: "tr" }, { code: "de", label: "Deutsch", flag: "de" },
  { code: "fr", label: "Français", flag: "fr" }, { code: "en", label: "English", flag: "gb" },
  { code: "ar", label: "العربية", flag: "sa" }, { code: "fa", label: "فارسی", flag: "ir" },
  { code: "ru", label: "Русский", flag: "ru" }, { code: "nl", label: "Nederlands", flag: "nl" },
];
export const isRtl = (locale: string) => locale === "ar" || locale === "fa";
export const isLocale = (value: unknown): value is Locale => locales.some((item) => item.code === value);

/** "Label: value" messages translate the label and keep the value (e.g. "Geçersiz para birimi: JPY"). */
export function translateWith(lookup: (key: string) => string | undefined, key: string) {
  const direct = lookup(key);
  if (direct) return direct;
  const at = key.indexOf(": ");
  const label = at > 0 ? lookup(key.slice(0, at)) : undefined;
  return label ? `${label}: ${key.slice(at + 2)}` : key;
}
/** Address of one language's messages (app/i18n/[file]/route.ts); the version changes with the dictionary. */
export const messagesUrl = (locale: Locale, version: string) => `/i18n/${locale}.json?v=${version}`;
