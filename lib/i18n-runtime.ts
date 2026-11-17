// Browser stand-in for lib/i18n-dictionary.ts (aliased in vite.config.ts and next.config.ts for the client
// bundle only). The full dictionary of every language is about 2.4 MB of JavaScript; the browser instead
// loads one language's messages (~400 KB of JSON, cached for a year) from /i18n/<locale>.json and looks
// keys up there. Turkish needs none. Server rendering keeps using the real dictionary, so the text is the same.
import { isLocale, isRtl, locales, messagesUrl, translateWith, type Locale } from "./locales";
export { isLocale, isRtl, locales, type Locale };

const loaded: Partial<Record<Locale, Record<string, string>>> = { tr: {} };
const pending: Partial<Record<Locale, Promise<void>>> = {};
let version = "0";

/** Set by the LocaleProvider from the server so message URLs change whenever the dictionary does. */
export function setMessagesVersion(value: string) { version = value || version; }
export const messagesReady = (locale: Locale) => Boolean(loaded[locale]);
/** One request per language; the same promise is returned while it loads (React use() needs a stable one). */
export function loadMessages(locale: Locale): Promise<void> {
  if (loaded[locale]) return Promise.resolve();
  return pending[locale] ??= fetch(messagesUrl(locale, version)).then((response) => response.ok ? response.json() as Promise<Record<string, string>> : {})
    .then((messages) => { loaded[locale] = messages; })
    .catch(() => { delete pending[locale]; loaded[locale] = loaded[locale] || {}; });
}
export function translate(key: string, locale: Locale) {
  const messages = loaded[locale];
  return messages ? translateWith((item) => messages[item], key) : key;
}
/** Kept for imports that only exist on the server; empty in the browser. */
export const words: Record<string, Partial<Record<Locale, string>>> = {};
export const messagesFor = (locale: Locale) => loaded[locale] || {};
export const MESSAGES_VERSION = "client";
