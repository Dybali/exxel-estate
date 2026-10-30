// Subtypes for business premises and tourist facilities, stored in listing.presentation under
// their own field; the Turkish value is stored and translated for display, like the land options.
export const BUSINESS_TYPES = ["Akaryakıt İstasyonu", "Apartman Dairesi", "Atölye", "Çiftlik", "Depo & Antrepo", "Dükkan & Mağaza", "Fabrika & Üretim Tesisi", "Garaj & Park Yeri", "Hamam, Sauna & Spa", "İmalathane", "İş Hanı Katı & Ofisi", "Komple Bina", "Maden Ocağı", "Ofis & Büro", "Okul", "Otopark", "Pazar Yeri", "Plaza", "Plaza Katı & Ofisi", "Rezidans Katı & Ofisi", "Spor Tesisi", "Toplantı & Etkinlik Salonu", "Villa"] as const;
export const TOURISM_TYPES = ["Otel", "Apart Otel", "Butik Otel", "Motel", "Pansiyon", "Kamp Yeri (Mocamp)", "Tatil Köyü"] as const;

export type SubtypeField = "businessType" | "tourismType";
export const SUBTYPES: Record<string, { field: SubtypeField; label: string; options: readonly string[] }> = {
  ticari: { field: "businessType", label: "İş yeri tipi", options: BUSINESS_TYPES },
  turistik: { field: "tourismType", label: "Tesis tipi", options: TOURISM_TYPES },
};
export const SUBTYPE_FIELDS = Object.values(SUBTYPES);
export const subtypeFor = (field: SubtypeField) => SUBTYPE_FIELDS.find((item) => item.field === field)!;

// Returns the validated subtype of a listing request ({businessType} or {tourismType}), or {} when none applies.
export function subtypeFrom(data: Record<string, unknown>): Partial<Record<SubtypeField, string>> {
  const subtype = SUBTYPES[String(data.propertyType)];
  if (!subtype) return {};
  const value = data[subtype.field] == null ? "" : String(data[subtype.field]).trim();
  if (!value) return {};
  if (!subtype.options.includes(value)) throw Error(`Geçersiz seçim: ${subtype.label}`);
  return { [subtype.field]: value };
}
