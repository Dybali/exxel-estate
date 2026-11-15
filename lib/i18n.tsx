"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isLocale, isRtl, locales, translate, type Locale } from "./i18n-dictionary";
import { LOCALE_COOKIE } from "./locale-negotiation";
export { isLocale, isRtl, locales, translate, type Locale };

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string }>({
  locale: "tr", setLocale: () => {}, t: (key) => key,
});

// initialLocale comes from the server (?lang=xx, saved choice or browser language), so crawlers and
// visitors receive the page in that language from the first byte.
export function LocaleProvider({ children, initialLocale = "tr" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    const saved = window.localStorage.getItem("exxel_locale");
    // Only an explicit ?lang or the visitor's saved choice overrides the server's language. The browser
    // languages were already weighed on the server (Accept-Language); guessing again here made pages flip
    // after hydration, e.g. Turkish pages turning English for crawlers whose renderer reports en-US.
    const selected = [requested, saved].find(isLocale);
    if (selected) setLocale(selected);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
    window.localStorage.setItem("exxel_locale", locale);
    // The server reads this on the next visit and renders the page in the same language.
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax${window.location.protocol === "https:" ? ";secure" : ""}`;
  }, [locale]);
  const choose = (next: Locale) => {
    const url = new URL(window.location.href);
    // Keep a shared ?lang link in step with the visitor's own choice.
    if (url.searchParams.has("lang")) {
      if (next === "tr") url.searchParams.delete("lang"); else url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
    setLocale(next);
  };
  const value = useMemo(() => ({ locale, setLocale: choose, t: (key: string) => translate(key, locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
export function T({ id }: { id: string }) { const { t } = useLocale(); return <>{t(id)}</>; }
export function Money({ value, currency = "TRY",fractionDigits=0 }: { value: number; currency?: string;fractionDigits?:number }) {
  const { locale } = useLocale();
  return <>{new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: fractionDigits }).format(value)}</>;
}
