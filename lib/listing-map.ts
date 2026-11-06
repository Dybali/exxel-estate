import { isolate } from "./display-currency";
import { safeImageUrl } from "./safe-image-url";
// Small display helpers for the /ilanlar map (components/PropertyMap.tsx).

/** Short marker label in the display currency: "₺12,8 Mn", "€1.2M"; "≈" when converted. */
export function compactMoney(amount: number, currency: string, locale: string, approximate = false) {
  let text: string;
  try {
    text = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: currency === "TRY" ? "narrowSymbol" : "symbol", notation: "compact", maximumFractionDigits: amount >= 1000 ? 1 : 0 }).format(amount);
  } catch {
    text = `${Math.round(amount)} ${currency}`;
  }
  return isolate(approximate ? `≈ ${text}` : text);
}

/** Card photo: our own media paths or a safe https URL; anything else is dropped. */
export function mapImage(value: unknown) {
  if (typeof value !== "string") return null;
  if (/^\/(?!\/)[\w\-./%]+$/.test(value)) return value;
  return safeImageUrl(value)?.href || null;
}
