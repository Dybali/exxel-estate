// Translations for portal features added after the Persian launch: one object per
// Turkish source text with every other language side by side.
type Row = { de: string; fr: string; en: string; ar: string; fa: string; ru: string };

export const portalWords: Record<string, Row> = {
  "Fotoğraflar yüklenirken küçültülür, WebP biçimine çevrilir ve estatemarket24 filigranı eklenir. Konum gibi gizli dosya bilgileri silinir.": {
    de: "Fotos werden beim Hochladen verkleinert, in WebP umgewandelt und mit einem estatemarket24-Wasserzeichen versehen. Versteckte Dateidaten wie der Standort werden entfernt.",
    fr: "Les photos sont réduites, converties en WebP et marquées du filigrane estatemarket24 lors de l'envoi. Les métadonnées cachées comme la position sont supprimées.",
    en: "Photos are resized, converted to WebP and given an estatemarket24 watermark on upload. Hidden file data such as location is removed.",
    ar: "تُصغَّر الصور عند الرفع وتُحوَّل إلى WebP وتُضاف إليها علامة estatemarket24 المائية. وتُحذف بيانات الملف المخفية مثل الموقع.",
    fa: "عکس‌ها هنگام بارگذاری کوچک می‌شوند، به WebP تبدیل می‌شوند و واترمارک estatemarket24 می‌گیرند. اطلاعات پنهان فایل مانند موقعیت مکانی حذف می‌شود.",
    ru: "При загрузке фото уменьшаются, конвертируются в WebP и получают водяной знак estatemarket24. Скрытые данные файла, например местоположение, удаляются.",
  },
};
