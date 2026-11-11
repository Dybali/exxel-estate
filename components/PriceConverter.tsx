"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useDisplayCurrency } from "@/components/DisplayCurrency";
import { useLocale } from "@/lib/i18n";
import { formatMoney, formatRateDate, priceInTl } from "@/lib/display-currency";

const CHOICES = ["EUR", "USD", "GBP"] as const;

/**
 * Listing prices are stored in TL. Owners who think in euro, dollar or pound (e.g. living abroad) type
 * that amount here and get the TL price from the page's TCMB rates; nothing but the TL price is saved.
 */
export function PriceConverter({ onUse }: { onUse: (tl: string) => void }) {
  const { t, locale } = useLocale(), { rates, currency: display } = useDisplayCurrency();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<typeof CHOICES[number]>((CHOICES as readonly string[]).includes(display) ? display as typeof CHOICES[number] : "EUR");
  const value = Number(amount), tl = value > 0 ? priceInTl(value, currency, rates) : undefined;
  if (!rates || priceInTl(1, "EUR", rates) === undefined) return null;
  const rounded = tl === undefined ? null : Math.round(tl / 1000) * 1000 || Math.round(tl);
  return <div className="price-converter span-2">
    <strong>{t("Fiyatı başka bir para biriminde mi biliyorsunuz?")}</strong>
    <div className="price-converter-row">
      <input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={t("Tutar")} placeholder={t("Tutar")}/>
      <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof CHOICES[number])} aria-label={t("Para birimi")}>{CHOICES.map((code) => <option key={code} value={code}>{code}</option>)}</select>
      <button type="button" className="outline-button" disabled={rounded === null} onClick={() => { if (rounded !== null) onUse(String(rounded)); }}>
        {rounded === null ? t("TL fiyatını hesapla") : <>{t("TL fiyatı olarak kullan")}: <bdi>{formatMoney(rounded, "TRY", locale)}</bdi></>}<ArrowRight size={15} aria-hidden="true"/>
      </button>
    </div>
    <small>{t("TCMB kuruyla hesaplanır ve yuvarlanır; ilan TL fiyatıyla kaydedilir.")} {rates.date ? formatRateDate(rates.date, locale) : ""}</small>
  </div>;
}
