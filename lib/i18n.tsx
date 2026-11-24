"use client";
import { createContext, use, useContext, useEffect, useMemo, useState } from "react";
import { isLocale, isRtl, loadMessages, locales, messagesReady, setMessagesVersion, translate, type Locale } from "@/lib/i18n-dictionary";
import { LOCALE_COOKIE } from "./locale-negotiation";
export { isLocale, isRtl, locales, translate, type Locale };

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string }>({
  locale: "tr", setLocale: () => {}, t: (key) => key,
});

// initialLocale comes from the server (?lang=xx, saved choice or browser language), so crawlers and
// visitors receive the page in that language from the first byte.
// In the browser the messages of the page's language load from /i18n/<locale>.json (lib/i18n-runtime.ts).
// Until they arrive the app stays suspended: during hydration React keeps the server's HTML on screen, so
// visitors never see untranslated text and there is no hydration mismatch.
function MessagesGate({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  if (!messagesReady(locale)) use(loadMessages(locale));
  return <>{children}</>;
}
export function LocaleProvider({ children, initialLocale = "tr", messagesVersion = "" }: { children: React.ReactNode; initialLocale?: Locale; messagesVersion?: string }) {
  setMessagesVersion(messagesVersion);
  const [locale, setLocaleNow] = useState<Locale>(initialLocale);
  // Another language is shown once its messages are loaded, so the page never flashes untranslated keys.
  const setLocale = (next: Locale) => { if (messagesReady(next)) setLocaleNow(next); else void loadMessages(next).then(() => setLocaleNow(next)); };
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
  // No Suspense boundary here: while hydrating, the root itself waits for the messages and keeps the server HTML.
  // A boundary around every page made the server send the shell before the page ran, so notFound() answered 200
  // instead of 404 (live-site sweep 2026-11-24). On the server the messages are always ready and nothing suspends.
  return <LocaleContext.Provider value={value}><MessagesGate locale={locale}>{children}</MessagesGate></LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
export function T({ id }: { id: string }) { const { t } = useLocale(); return <>{t(id)}</>; }
export function Money({ value, currency = "TRY",fractionDigits=0 }: { value: number; currency?: string;fractionDigits?:number }) {
  const { locale } = useLocale();
  return <>{new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: fractionDigits }).format(value)}</>;
}
