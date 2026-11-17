// Which language a page is rendered in, decided on the server (proxy.ts, build/sites-worker.ts):
// ?lang=xx, then the visitor's saved choice, then the first of the browser's languages the site offers,
// else Turkish. The browser (lib/i18n.tsx) keeps that language and only follows ?lang or a saved choice,
// so the first HTML, the page title and the hydrated page stay in one language.
import { isLocale, type Locale } from "./locales";

/** The saved language choice; written by the browser (lib/i18n.tsx), listed in the cookie policy. */
export const LOCALE_COOKIE = "em24_locale";

/** First supported language of a preference list such as ["de-AT", "en"], or undefined. */
export function preferredLocale(languages: readonly string[]): Locale | undefined {
  for (const tag of languages.slice(0, 12)) {
    const code = tag.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return undefined;
}

/** Accept-Language header → tags in the order sent, without entries the visitor ruled out (q=0). */
export function acceptedLanguages(header: string | null | undefined) {
  return (header || "").slice(0, 500).split(",").map((part) => part.trim()).filter((part) => part && !/;\s*q=0(\.0*)?$/i.test(part)).map((part) => part.split(";")[0]);
}

export function negotiateLocale(lang: string | null | undefined, cookieHeader: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(lang)) return lang;
  const saved = (cookieHeader || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
  if (isLocale(saved)) return saved;
  return preferredLocale(acceptedLanguages(acceptLanguage)) || "tr";
}
