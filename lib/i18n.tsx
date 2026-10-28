"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isLocale, isRtl, locales, translate, type Locale } from "./i18n-dictionary";
export { isLocale, isRtl, locales, translate, type Locale };

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string }>({
  locale: "tr", setLocale: () => {}, t: (key) => key,
});

// initialLocale comes from the server (?lang=xx) so crawlers receive the page in that language.
export function LocaleProvider({ children, initialLocale = "tr" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    const saved = window.localStorage.getItem("exxel_locale");
    const browser = navigator.language.slice(0, 2).toLowerCase();
    const selected = [requested, saved, browser].find(isLocale);
    if (selected) setLocale(selected);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
    window.localStorage.setItem("exxel_locale", locale);
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
