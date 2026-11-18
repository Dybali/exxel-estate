// Agent service fee ("hizmet bedeli", komisyon) shown on a listing, like the commission line on German portals.
// Optional; stored in listings.presentation.commission. Limits from the Taşınmaz Ticareti Hakkında Yönetmelik:
//   sale: at most 4 % of the price plus VAT in total, split equally between buyer and seller unless agreed
//         otherwise, so the buyer's share is entered (usually 2 %) and may not exceed 4 %;
//   rent: at most one month's rent plus VAT in total, tenant and owner half each by default, so the tenant's
//         share is entered in months (usually 0.5) and may not exceed 1.
// Daily (tourism) rentals and business transfers have no field. docs/listing-commission.md.
export type Commission = { type: "none" } | { type: "share"; value: number };
export type CommissionPurpose = "sale" | "rent";

export const COMMISSION_MAX = { sale: 4, rent: 1 } as const;
export const COMMISSION_DEFAULT = { sale: 2, rent: 0.5 } as const;

export function commissionPurpose(purpose: unknown): CommissionPurpose | null {
  return purpose === "satilik" ? "sale" : purpose === "kiralik" ? "rent" : null;
}

/** Form fields commissionType ("" | "none" | "share") and commissionValue → stored value; throws a user message. */
export function commissionFrom(data: Record<string, unknown>): Commission | undefined {
  const kind = commissionPurpose(data.purpose);
  // Updates without the form fields (other editors, imports) keep the stored statement.
  if (data.commissionType === undefined) return listingCommission({ commission: data.commission }, data.purpose) ?? undefined;
  const type = data.commissionType == null ? "" : String(data.commissionType);
  if (!kind || type === "") return undefined;
  if (type === "none") return { type: "none" };
  if (type !== "share") throw Error("Hizmet bedeli seçeneğini kontrol edin.");
  const raw = String(data.commissionValue ?? "").trim().replace(",", ".");
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) throw Error(kind === "sale" ? "Alıcının ödeyeceği hizmet bedeli oranını girin." : "Kiracının ödeyeceği hizmet bedelini ay olarak girin.");
  if (value > COMMISSION_MAX[kind]) throw Error(kind === "sale"
    ? "Satışta hizmet bedeli yasal olarak satış bedelinin en fazla %4'ü + KDV olabilir."
    : "Kiralamada hizmet bedeli yasal olarak en fazla bir aylık kira + KDV olabilir.");
  return { type: "share", value: Math.round(value * 100) / 100 };
}

/** Stored value for a purpose; anything malformed (or for another purpose) reads as no statement. */
export function listingCommission(presentation: { commission?: unknown } | null | undefined, purpose: unknown): Commission | null {
  const kind = commissionPurpose(purpose), value = presentation?.commission as Commission | undefined;
  if (!kind || !value || typeof value !== "object") return null;
  if (value.type === "none") return value;
  return value.type === "share" && Number.isFinite(value.value) && value.value > 0 && value.value <= COMMISSION_MAX[kind] ? value : null;
}

/** Approximate fee before VAT for the price shown (sale: percent of price, rent: months of rent). */
export function commissionAmount(commission: Commission | null, price: number, purpose: unknown): number | null {
  const kind = commissionPurpose(purpose);
  if (!kind || !commission || commission.type !== "share" || !(price > 0)) return null;
  return Math.round(kind === "sale" ? price * commission.value / 100 : price * commission.value);
}

/** Translation key and number for the line under the price. */
export function commissionLabel(commission: Commission | null, purpose: unknown): { key: string; n?: number } | null {
  const kind = commissionPurpose(purpose);
  if (!kind || !commission) return null;
  if (commission.type === "none") return { key: "Komisyonsuz" };
  return kind === "sale" ? { key: "Alıcı hizmet bedeli: %{n} + KDV", n: commission.value } : { key: "Kiracı hizmet bedeli: {n} aylık kira + KDV", n: commission.value };
}
