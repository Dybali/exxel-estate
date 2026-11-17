// /hesaplama-araclari: rent increase, title deed fee (tapu harcı) and title deed costs. Pure functions so the
// page and the tests share one implementation (docs/calculators.md).
//
// Rent increase: since 1 July 2024 the yearly increase of residential and commercial rents is capped by the
// 12-month average change of the consumer price index (TÜFE, Türk Borçlar Kanunu md. 344) that TÜİK announces
// each month. That rate changes monthly, so it is entered by the visitor; RENT_INCREASE_RATE (server setting,
// e.g. "34.88") only prefills the field and is shown with the month it belongs to (RENT_INCREASE_MONTH).
// Title deed fee: 492 sayılı Harçlar Kanunu (4) sayılı tarife: binde 20 from the buyer and binde 20 from the
// seller, on the declared value, which may not be below the property's emlak vergi değeri.
// The revolving-fund fee (döner sermaye) is set each year by the land registry; it is entered as well
// (DEED_REVOLVING_FEE prefills it).

export const DEED_FEE_RATE = 0.02;

const money = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
const round = (value: number) => Math.round(value * 100) / 100;

export function rentIncrease(rent: unknown, ratePercent: unknown) {
  const current = money(rent), rate = Number(ratePercent);
  if (!current || !Number.isFinite(rate) || rate < 0 || rate > 500) return null;
  const increase = round(current * rate / 100);
  return { current, rate, increase, next: round(current + increase), yearly: round((current + increase) * 12) };
}

export type FeeSplit = "both" | "buyer";
/** Each side pays binde 20; "buyer" means the buyer takes over the seller's share as well (a common agreement). */
export function deedFee(price: unknown, split: FeeSplit = "both") {
  const value = money(price);
  if (!value) return null;
  const share = round(value * DEED_FEE_RATE);
  return split === "buyer" ? { value, buyer: round(share * 2), seller: 0, total: round(share * 2) } : { value, buyer: share, seller: share, total: round(share * 2) };
}

export type DeedCostInput = { price: unknown; split?: FeeSplit; revolvingFee?: unknown; dask?: unknown; appraisal?: unknown; commissionPercent?: unknown };
/** The buyer's side of a purchase: fee, revolving-fund fee, compulsory earthquake insurance (DASK), appraisal
 *  (needed for a mortgage) and the agent's commission; every item except the fee is optional. */
export function deedCosts(input: DeedCostInput) {
  const fee = deedFee(input.price, input.split || "both");
  if (!fee) return null;
  const commissionRate = Number(input.commissionPercent);
  const items = [
    { key: "fee", label: "Tapu harcı (alıcı payı)", amount: fee.buyer },
    { key: "revolving", label: "Döner sermaye ücreti", amount: money(input.revolvingFee) },
    { key: "dask", label: "Zorunlu deprem sigortası (DASK)", amount: money(input.dask) },
    { key: "appraisal", label: "Ekspertiz (konut kredisi için)", amount: money(input.appraisal) },
    { key: "commission", label: "Emlakçı hizmet bedeli", amount: Number.isFinite(commissionRate) && commissionRate > 0 && commissionRate <= 10 ? round(fee.value * commissionRate / 100) : 0 },
  ].filter((item) => item.amount > 0);
  return { value: fee.value, items, total: round(items.reduce((sum, item) => sum + item.amount, 0)), sellerFee: fee.seller };
}

/** Server settings that prefill the inputs; anything malformed is ignored. */
export function calculatorDefaults(settings: Record<string, unknown>) {
  const number = (value: unknown) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
  const month = String(settings.RENT_INCREASE_MONTH ?? "");
  return { rentRate: number(settings.RENT_INCREASE_RATE), rentMonth: /^\d{4}-\d{2}$/.test(month) ? month : null, revolvingFee: number(settings.DEED_REVOLVING_FEE) };
}
