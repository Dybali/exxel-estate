import {PROPERTY_CATEGORIES} from './property-categories';

// Portal style listing details stored in listing.presentation.details. Each applies only to the
// categories listed; the Turkish value is stored and translated for display.
export const DETAIL_FIELDS = [
  { key: "kitchen", form: "detailKitchen", label: "Mutfak", options: ["Açık (Amerikan)", "Kapalı"], categories: ["konut"] },
  { key: "usage", form: "detailUsage", label: "Kullanım Durumu", options: ["Boş", "Kiracılı", "Mülk Sahibi"], categories: ["konut", "isyeri", "bina"] },
  { key: "site", form: "detailSite", label: "Site İçerisinde", options: ["Evet", "Hayır"], categories: ["konut"] },
  { key: "credit", form: "detailCredit", label: "Krediye Uygun", options: ["Evet", "Hayır", "Bilinmiyor"], categories: ["konut", "isyeri", "bina", "devremulk"] },
  { key: "deed", form: "detailDeed", label: "Tapu Durumu", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Hisseli Tapu", "Müstakil Tapulu", "Arsa Tapulu", "Kooperatif Hisseli Tapu", "İntifa Hakkı Tesisli", "Yurt Dışı Tapulu", "Tapu Kaydı Yok"], categories: ["konut", "isyeri", "bina", "devremulk", "turistik"] },
  { key: "swap", form: "detailSwap", label: "Takas", options: ["Evet", "Hayır"], categories: ["konut", "isyeri", "bina", "devremulk", "turistik"] },
] as const;
export type DetailKey = typeof DETAIL_FIELDS[number]["key"];
export type DetailForm = typeof DETAIL_FIELDS[number]["form"];
export type ListingDetails = Partial<Record<DetailKey | "foreignSale", string>>;

// "Yabancıya satışa uygun" is the advertiser's own statement, stored as details.foreignSale. Every
// category can in principle be sold to foreigners (Tapu Kanunu md. 35 sets area, district and
// security-zone limits), but it is asked only for "satılık" listings: rentals and business transfers
// (devren) are not property acquisitions.
export const FOREIGN_SALE = { key: "foreignSale", form: "foreignSale", label: "Yabancıya satışa uygun", options: ["Evet", "Hayır", "Bilinmiyor"], purposes: ["satilik"] } as const;
export const foreignSaleApplies = (purpose: string, propertyType: string) =>
  (FOREIGN_SALE.purposes as readonly string[]).includes(purpose) && categoryOfType(propertyType) !== "";
// The listing's statement when it applies ("Evet" | "Hayır" | "Bilinmiyor"), else "".
export const foreignSaleOf = (listing: { purpose: string; propertyType: string; presentation?: { details?: ListingDetails } }) =>
  foreignSaleApplies(listing.purpose, listing.propertyType) ? listing.presentation?.details?.foreignSale || "" : "";

export const categoryOfType = (propertyType: string) => PROPERTY_CATEGORIES.find((item) => (item.types as readonly string[]).includes(propertyType))?.value || "";
export const detailsFor = (category: string) => DETAIL_FIELDS.filter((field) => (field.categories as readonly string[]).includes(category));

// Validates the detail inputs of a listing request; returns undefined when nothing was entered.
export function detailsFrom(data: Record<string, unknown>): ListingDetails | undefined {
  const details: ListingDetails = {};
  for (const field of detailsFor(categoryOfType(String(data.propertyType || "")))) {
    const value = data[field.form] == null ? "" : String(data[field.form]).trim();
    if (!value) continue;
    if (!(field.options as readonly string[]).includes(value)) throw Error(`Geçersiz seçim: ${field.label}`);
    details[field.key] = value;
  }
  const foreign = data[FOREIGN_SALE.form] == null ? "" : String(data[FOREIGN_SALE.form]).trim();
  if (foreign && foreignSaleApplies(String(data.purpose || ""), String(data.propertyType || ""))) {
    if (!(FOREIGN_SALE.options as readonly string[]).includes(foreign)) throw Error(`Geçersiz seçim: ${FOREIGN_SALE.label}`);
    details.foreignSale = foreign;
  }
  return Object.keys(details).length ? details : undefined;
}

// Rows for the listing page; empty values read "Belirtilmemiş" like the land rows.
export const detailFacts = (propertyType: string, details?: ListingDetails) =>
  detailsFor(categoryOfType(propertyType)).map((field) => [field.label, details?.[field.key] || "Belirtilmemiş"] as [string, string]);

// Room layouts come from a list or are typed by the advertiser ("Diğer"), e.g. 7+2 or 4.5+2.
export const validRooms = (value: unknown) => value == null || value === "" || typeof value === "string" && /^(\d{1,2}(\.5)?\+\d{1,2}|10 Üzeri)$/.test(value.trim());
