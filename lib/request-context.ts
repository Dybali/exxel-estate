import { headers } from "next/headers";
import { isLocale, locales, type Locale } from "./locales";
import { LOCALE_HEADER, PATH_HEADER } from "./request-headers";
import { siteUrl } from "./site-url";

export { siteUrl };

export async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : "tr";
}

export async function requestPath() {
  const value = (await headers()).get(PATH_HEADER) || "/";
  return value.startsWith("/") ? value : "/";
}


export function localizedUrl(path: string, locale: Locale) {
  const url = new URL(path, siteUrl());
  if (locale === "tr") url.searchParams.delete("lang"); else url.searchParams.set("lang", locale);
  return url.toString();
}

export function languageAlternates(path: string) {
  return Object.fromEntries([
    ...locales.map((item) => [item.code, localizedUrl(path, item.code)]),
    ["x-default", localizedUrl(path, "tr")],
  ]);
}

export async function pageAlternates(path: string) {
  return { canonical: localizedUrl(path, await requestLocale()), languages: languageAlternates(path) };
}
