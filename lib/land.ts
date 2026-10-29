// Land (arsa) details stored in listing.presentation.land. Option lists follow the usual
// Turkish land listing vocabulary; the Turkish value is stored and translated for display.
export const LAND_ZONING = ["Konut", "Ticari", "Ticari + Konut", "Turizm", "Turizm + Konut", "Turizm + Ticari", "Villa", "Toplu Konut", "Sanayi", "Depo & Antrepo", "Tarla", "Tarla + Depo", "Bağ & Bahçe", "Zeytinlik", "Sera", "Eğitim", "Sağlık", "Spor Alanı", "Kültürel Tesis", "Enerji Depolama", "Özel Kullanım", "Sit Alanı", "Muhtelif", "İmarsız"] as const;
export const LAND_DEED = ["Müstakil Tapulu", "Hisseli Tapulu", "Tahsis Tapulu", "Zilliyet", "Kooperatif Hisseli", "Belirtilmemiş"] as const;
export const LAND_CREDIT = ["Evet", "Hayır", "Bilinmiyor"] as const;
export const LAND_SWAP = ["Evet", "Hayır"] as const;

export type LandDetails = { zoning?: string; block?: string; parcel?: string; sheet?: string; kaks?: string; gabari?: string; credit?: string; deed?: string; swap?: string };
// Form field name → stored key.
export const LAND_FIELDS = { landZoning: "zoning", landBlock: "block", landParcel: "parcel", landSheet: "sheet", landKaks: "kaks", landGabari: "gabari", landCredit: "credit", landDeed: "deed", landSwap: "swap" } as const;
export type LandField = keyof typeof LAND_FIELDS;

const pick = (value: string, options: readonly string[], label: string) => { if (value && !options.includes(value)) throw Error(`Geçersiz seçim: ${label}`); return value; };

// Validates the land inputs of a listing request; returns undefined when nothing was entered.
export function landFrom(data: Record<string, unknown>): LandDetails | undefined {
  const read = (key: LandField) => { const value = data[key]; return typeof value === "string" ? value.trim().slice(0, 40) : value == null ? "" : String(value).trim().slice(0, 40); };
  const land: LandDetails = {
    zoning: pick(read("landZoning"), LAND_ZONING, "İmar Durumu"),
    credit: pick(read("landCredit"), LAND_CREDIT, "Krediye Uygunluk"),
    deed: pick(read("landDeed"), LAND_DEED, "Tapu Durumu"),
    swap: pick(read("landSwap"), LAND_SWAP, "Takas"),
  };
  for (const [field, key, label] of [["landBlock", "block", "Ada No"], ["landParcel", "parcel", "Parsel No"], ["landSheet", "sheet", "Pafta No"]] as const) {
    const value = read(field);
    if (value && !/^[\p{L}\p{N}][\p{L}\p{N} ./-]{0,19}$/u.test(value)) throw Error(`Geçersiz değer: ${label}`);
    land[key] = value;
  }
  const kaks = read("landKaks").replace(",", ".");
  if (kaks && !(/^\d{1,2}(\.\d{1,2})?$/.test(kaks) && Number(kaks) <= 20)) throw Error("Geçersiz değer: Kaks (Emsal)");
  land.kaks = kaks;
  const gabari = read("landGabari").replace(",", ".");
  if (gabari && !/^(\d{1,3}(\.\d{1,2})?|Serbest)$/.test(gabari)) throw Error("Geçersiz değer: Gabari");
  land.gabari = gabari;
  const entries = Object.entries(land).filter(([, value]) => value);
  return entries.length ? Object.fromEntries(entries) as LandDetails : undefined;
}

// Rows for the listing page; empty values read "Belirtilmemiş" like other land portals.
export function landFacts(land: LandDetails | undefined) {
  const value = (v?: string) => v || "Belirtilmemiş";
  return [
    ["İmar Durumu", value(land?.zoning)], ["Ada No", value(land?.block)], ["Parsel No", value(land?.parcel)], ["Pafta No", value(land?.sheet)],
    ["Kaks (Emsal)", value(land?.kaks)], ["Gabari", value(land?.gabari)], ["Krediye Uygunluk", value(land?.credit)], ["Tapu Durumu", value(land?.deed)], ["Takas", value(land?.swap)],
  ] as [string, string][];
}
