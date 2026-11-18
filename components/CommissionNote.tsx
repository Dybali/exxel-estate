"use client";
import { BadgePercent } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { DisplayMoney } from "@/components/DisplayCurrency";
import { commissionAmount, commissionLabel, type Commission } from "@/lib/listing-commission";

// Service fee line under the price on the listing page (lib/listing-commission.ts).
export function CommissionNote({ commission, purpose, price, currency }: { commission: Commission | null; purpose: string; price: number; currency: string }) {
  const { t, locale } = useLocale();
  const label = commissionLabel(commission, purpose);
  if (!label) return null;
  const amount = commissionAmount(commission, price, purpose);
  const n = label.n == null ? "" : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(label.n);
  return <p className={`commission-note${commission?.type === "none" ? " free" : ""}`}>
    <BadgePercent size={16} aria-hidden="true"/>
    <span>{t(label.key).replace("{n}", n)}{amount != null && <> · ≈ <DisplayMoney value={amount} currency={currency}/></>}</span>
  </p>;
}
