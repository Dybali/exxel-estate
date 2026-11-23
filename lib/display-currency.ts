import { fromTl, tlPerUnit, type RateSnapshot } from "./tcmb";

// Display currency of listing prices. Listing prices are stored in Turkish lira (base price); other
// currencies are approximate amounts computed for display only with the TCMB bulletin (lib/tcmb.ts).
// This is informational: contract and payment currency are not affected. Legacy listings that were
// entered in EUR/USD/GBP before TL-only entry keep their stored currency; their TL base is computed
// with the same bulletin (docs/listing-currency.md).

/** Currencies a visitor can choose. */
export const DISPLAY_CURRENCIES = ["TRY", "EUR", "USD", "GBP", "RUB", "SAR", "AED"] as const;
export type SelectableCurrency = typeof DISPLAY_CURRENCIES[number];
/** IRR is only the Persian language default: TCMB does not publish it, so prices stay in TL. */
export type DisplayCurrency = SelectableCurrency | "IRR";

/** Default when the visitor has not chosen a currency. */
export const LOCALE_CURRENCY: Record<string, DisplayCurrency> = { tr: "TRY", de: "EUR", fr: "EUR", nl: "EUR", es: "EUR", it: "EUR", en: "GBP", ru: "RUB", fa: "IRR", ar: "SAR" };
export const defaultDisplayCurrency = (locale: string): DisplayCurrency => LOCALE_CURRENCY[locale] || "TRY";

/** Country shortcuts of the selector (names come from Intl.DisplayNames in the visitor's language). */
export const EURO_COUNTRIES = ["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"] as const;
export const COUNTRY_CURRENCY: Record<string, SelectableCurrency> = {
  TR: "TRY", GB: "GBP", US: "USD", SA: "SAR", AE: "AED", RU: "RUB",
  ...Object.fromEntries(EURO_COUNTRIES.map((code) => [code, "EUR" as const])),
};

/** Explicit choice: localStorage (CURRENCY_STORAGE_KEY) and a first-party preference cookie for the server render. */
export const CURRENCY_COOKIE = "em24_currency";
export const CURRENCY_STORAGE_KEY = "em24:currency";
export const CURRENCY_COOKIE_DAYS = 365;

export const isSelectableCurrency = (value: unknown): value is SelectableCurrency => (DISPLAY_CURRENCIES as readonly unknown[]).includes(value);
export function currencyFromCookies(header: string | null | undefined): SelectableCurrency | null {
  for (const part of (header || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CURRENCY_COOKIE) { const value = rest.join("=").trim(); return isSelectableCurrency(value) ? value : null; }
  }
  return null;
}
export const currencyCookie = (value: SelectableCurrency | null) =>
  `${CURRENCY_COOKIE}=${value || ""}; Path=/; SameSite=Lax; Max-Age=${value ? CURRENCY_COOKIE_DAYS * 86400 : 0}`;
/** An explicit choice always wins; a language change only moves the default. */
export const resolveDisplayCurrency = (explicit: string | null | undefined, locale: string): DisplayCurrency =>
  isSelectableCurrency(explicit) ? explicit : defaultDisplayCurrency(locale);

/** The display currency can be shown with this snapshot (TRY always can). */
export const currencySupported = (currency: string, rates: RateSnapshot | null) => tlPerUnit(currency, rates) !== undefined;

/** Display rounding only: whole units below 10 000, then hundreds, thousands from one million. */
export function roundDisplay(value: number) {
  if (!Number.isFinite(value)) return value;
  const step = Math.abs(value) >= 1_000_000 ? 1000 : Math.abs(value) >= 10_000 ? 100 : 1;
  return Math.round(value / step) * step;
}

export type PriceView =
  /** Shown as stored: no conversion needed (display currency = listing currency). */
  | { kind: "base"; amount: number; currency: string }
  /** Approximate amount in the display currency; `base` is the stored price. */
  | { kind: "converted"; amount: number; currency: string; base: { amount: number; currency: string }; date: string; stale: boolean }
  /** Conversion not possible (currency not in the bulletin, or no usable bulletin): the stored price. */
  | { kind: "unavailable"; amount: number; currency: string; requested: string };

/** How one stored price is shown in `target`. `round` false keeps decimals (per-m² values round later). */
export function priceView(amount: number, currency: string, target: string, rates: RateSnapshot | null, { round = true } = {}): PriceView {
  if (target === currency || !Number.isFinite(amount)) return { kind: "base", amount, currency };
  const sourceRate = tlPerUnit(currency, rates), converted = sourceRate === undefined ? undefined : fromTl(amount * sourceRate, target, rates);
  if (converted === undefined || !rates) return { kind: "unavailable", amount, currency, requested: target };
  return { kind: "converted", amount: round ? roundDisplay(converted) : converted, currency: target, base: { amount, currency }, date: rates.date, stale: rates.stale };
}

/** Listing price in Turkish lira (base); undefined for a legacy currency without a rate. */
export const priceInTl = (amount: number, currency: string, rates: RateSnapshot | null) => {
  const rate = tlPerUnit(currency, rates);
  return rate === undefined ? undefined : amount * rate;
};

/** Intl number format for the UI locale; TRY always with the ₺ sign. Display only. */
export function formatMoney(amount: number, currency: string, locale: string, fractionDigits = 0) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: currency === "TRY" ? "narrowSymbol" : "symbol", minimumFractionDigits: 0, maximumFractionDigits: fractionDigits }).format(amount);
}
/** Bulletin date in the UI locale, Gregorian like the TCMB bulletin (tr: 05.11.2026). */
export const formatRateDate = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC", calendar: "gregory" }).format(new Date(`${date}T00:00:00Z`));
/** Localized currency name ("İran riyali"), falling back to the code. */
export function currencyName(currency: string, locale: string) {
  try { return new Intl.DisplayNames(locale, { type: "currency" }).of(currency) || currency; } catch { return currency; }
}
/** First-strong isolation for amounts inside plain strings (titles, map labels) in RTL pages. */
export const isolate = (text: string) => `⁨${text}⁩`;
