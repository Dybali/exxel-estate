import type { Locale } from "./locales";
import type { RegionPurpose, RegionType } from "./region-pages";

// Headings, titles and descriptions of the region pages (lib/region-pages.ts) in every language.
// Word order differs per language ("Bodrum Satılık Villalar", "Villas for Sale in Bodrum"), so these
// are templates rather than dictionary entries. Place names stay as written in Turkish.
type Words = Record<Locale, string>;

const NOUNS: Record<RegionType | "all", Words> = {
  all: { tr: "Emlak İlanları", de: "Immobilien", fr: "Biens immobiliers", en: "Property", ar: "عقارات", fa: "املاک", ru: "Недвижимость", nl: "Vastgoed", es: "Propiedades", it: "Immobili" },
  daire: { tr: "Daireler", de: "Wohnungen", fr: "Appartements", en: "Apartments", ar: "شقق", fa: "آپارتمان", ru: "Квартиры", nl: "Appartementen", es: "Apartamentos", it: "Appartamenti" },
  villa: { tr: "Villalar", de: "Villen", fr: "Villas", en: "Villas", ar: "فلل", fa: "ویلا", ru: "Виллы", nl: "Villa’s", es: "Villas", it: "Ville" },
  mustakil: { tr: "Müstakil Evler", de: "Einfamilienhäuser", fr: "Maisons individuelles", en: "Detached Houses", ar: "منازل مستقلة", fa: "خانهٔ مستقل", ru: "Частные дома", nl: "Vrijstaande huizen", es: "Casas independientes", it: "Case indipendenti" },
  rezidans: { tr: "Rezidanslar", de: "Residenzwohnungen", fr: "Résidences", en: "Residences", ar: "شقق ريزيدنس", fa: "رزیدنس", ru: "Апартаменты в резиденциях", nl: "Residenties", es: "Residencias", it: "Residenze" },
  yazlik: { tr: "Yazlıklar", de: "Ferienhäuser", fr: "Maisons de vacances", en: "Holiday Homes", ar: "منازل صيفية", fa: "خانهٔ تابستانی", ru: "Летние дома", nl: "Vakantiehuizen", es: "Casas vacacionales", it: "Case vacanza" },
  arsa: { tr: "Arsalar", de: "Grundstücke", fr: "Terrains", en: "Land", ar: "أراضٍ", fa: "زمین", ru: "Земельные участки", nl: "Bouwgrond", es: "Terrenos", it: "Terreni" },
  ticari: { tr: "İş Yerleri", de: "Gewerbeimmobilien", fr: "Locaux commerciaux", en: "Commercial Property", ar: "عقارات تجارية", fa: "ملک تجاری", ru: "Коммерческая недвижимость", nl: "Bedrijfspanden", es: "Locales comerciales", it: "Immobili commerciali" },
};
const PURPOSE: Record<RegionPurpose, Words> = {
  satilik: { tr: "Satılık", de: "zum Kauf", fr: "à vendre", en: "for Sale", ar: "للبيع", fa: "فروشی", ru: "на продажу", nl: "te koop", es: "en venta", it: "in vendita" },
  kiralik: { tr: "Kiralık", de: "zur Miete", fr: "à louer", en: "for Rent", ar: "للإيجار", fa: "اجاره‌ای", ru: "в аренду", nl: "te huur", es: "en alquiler", it: "in affitto" },
};
const PLACE: Record<Locale, (phrase: string, place: string) => string> = {
  tr: (phrase, place) => `${place} ${phrase}`,
  de: (phrase, place) => `${phrase} in ${place}`,
  fr: (phrase, place) => `${phrase} à ${place}`,
  en: (phrase, place) => `${phrase} in ${place}`,
  ar: (phrase, place) => `${phrase} في ${place}`,
  fa: (phrase, place) => `${phrase} در ${place}`,
  ru: (phrase, place) => `${phrase}: ${place}`,
  nl: (phrase, place) => `${phrase} in ${place}`,
  es: (phrase, place) => `${phrase} en ${place}`,
  it: (phrase, place) => `${phrase} a ${place}`,
};
const ALL_PROPERTY: Words = { tr: "Emlak İlanları", de: "Immobilien", fr: "Immobilier", en: "Real Estate", ar: "عقارات", fa: "املاک", ru: "Недвижимость", nl: "Vastgoed", es: "Inmuebles", it: "Immobili" };

/** "Satılık Villalar" / "Villas for Sale"; without a purpose the general "Emlak İlanları". */
export function regionPhrase(locale: Locale, purpose?: RegionPurpose, type?: RegionType) {
  if (!purpose) return ALL_PROPERTY[locale];
  const noun = NOUNS[type || "all"][locale], label = PURPOSE[purpose][locale];
  return locale === "tr" ? `${label} ${noun}` : `${noun} ${label}`;
}

/** H1 and page title: "Bodrum Satılık Villalar", "Villas for Sale in Bodrum". */
export const regionHeading = (place: string, locale: Locale, purpose?: RegionPurpose, type?: RegionType) => PLACE[locale](regionPhrase(locale, purpose, type), place);

const DESCRIPTION: Record<Locale, [listings: string, empty: string]> = {
  tr: ["Aktif ilan: {count}. Fiyatları, fotoğrafları ve ilan ayrıntılarını estatemarket24'te inceleyin.", "Yeni ilanlar yayınlandığında burada listelenir. Türkiye'deki tüm ilanları estatemarket24'te inceleyin."],
  de: ["Aktive Anzeigen: {count}. Preise, Fotos und Details auf estatemarket24 vergleichen.", "Neue Anzeigen erscheinen hier, sobald sie veröffentlicht sind. Alle Immobilien in der Türkei auf estatemarket24 ansehen."],
  fr: ["Annonces actives : {count}. Comparez prix, photos et détails sur estatemarket24.", "Les nouvelles annonces apparaîtront ici dès leur publication. Consultez toutes les annonces en Turquie sur estatemarket24."],
  en: ["Active listings: {count}. Compare prices, photos and details on estatemarket24.", "New listings appear here as soon as they are published. Browse all property in Türkiye on estatemarket24."],
  ar: ["الإعلانات النشطة: {count}. قارن الأسعار والصور والتفاصيل على estatemarket24.", "ستظهر الإعلانات الجديدة هنا فور نشرها. تصفح جميع العقارات في تركيا على estatemarket24."],
  fa: ["آگهی‌های فعال: {count}. قیمت‌ها، عکس‌ها و جزئیات را در estatemarket24 مقایسه کنید.", "آگهی‌های جدید پس از انتشار در اینجا نمایش داده می‌شوند. همهٔ املاک ترکیه را در estatemarket24 ببینید."],
  ru: ["Активные объявления: {count}. Сравните цены, фото и детали на estatemarket24.", "Новые объявления появятся здесь сразу после публикации. Вся недвижимость Турции — на estatemarket24."],
  nl: ["Actieve advertenties: {count}. Vergelijk prijzen, foto’s en details op estatemarket24.", "Nieuwe advertenties verschijnen hier zodra ze zijn gepubliceerd. Bekijk al het vastgoed in Turkije op estatemarket24."],
  es: ["Anuncios activos: {count}. Compara precios, fotos y detalles en estatemarket24.","Los nuevos anuncios aparecerán aquí en cuanto se publiquen. Explora todos los inmuebles de Türkiye en estatemarket24."],
  it: ["Annunci attivi: {count}. Confronta prezzi, foto e dettagli su estatemarket24.","I nuovi annunci vengono pubblicati qui appena disponibili. Sfoglia tutti gli immobili in Türkiye su estatemarket24."],
};

/** Meta description: the heading, then the real listing count (or a note that there is none yet). */
export function regionDescription(heading: string, count: number, locale: Locale) {
  const [listings, empty] = DESCRIPTION[locale];
  return `${heading}. ${count > 0 ? listings.replace("{count}", String(count)) : empty}`.slice(0, 200);
}
