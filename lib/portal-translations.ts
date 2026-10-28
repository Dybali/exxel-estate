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
  "Alan çiz": { de: "Gebiet zeichnen", fr: "Dessiner une zone", en: "Draw area", ar: "ارسم منطقة", fa: "محدوده بکشید", ru: "Нарисовать область" },
  "Çizimi bitir": { de: "Zeichnung abschließen", fr: "Terminer le tracé", en: "Finish drawing", ar: "إنهاء الرسم", fa: "پایان ترسیم", ru: "Завершить" },
  "Çizimi iptal et": { de: "Zeichnung abbrechen", fr: "Annuler le tracé", en: "Cancel drawing", ar: "إلغاء الرسم", fa: "لغو ترسیم", ru: "Отменить" },
  "Haritaya tıklayarak alanın köşelerini işaretleyin; en az 3 nokta gerekir.": { de: "Klicken Sie auf die Karte, um die Ecken des Gebiets zu setzen; mindestens 3 Punkte.", fr: "Cliquez sur la carte pour placer les coins de la zone ; au moins 3 points.", en: "Click the map to mark the corners of the area; at least 3 points are needed.", ar: "انقر على الخريطة لتحديد زوايا المنطقة؛ يلزم 3 نقاط على الأقل.", fa: "با کلیک روی نقشه گوشه‌های محدوده را مشخص کنید؛ دست‌کم ۳ نقطه لازم است.", ru: "Нажимайте на карту, чтобы отметить углы области; нужно не менее 3 точек." },
  "Çizilen alan seçili": { de: "Gezeichnetes Gebiet aktiv", fr: "Zone dessinée active", en: "Drawn area selected", ar: "المنطقة المرسومة محددة", fa: "محدودهٔ ترسیم‌شده انتخاب شده", ru: "Выбрана нарисованная область" },
};
