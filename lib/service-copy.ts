import { translate, type Locale } from "@/lib/i18n-dictionary";
import { serviceCategory } from "./service-categories";
import { SERVICE_BASE, servicePath } from "./services";

// Headings and meta descriptions of the service pages (/hizmetler/...) in every language. Word order
// differs per language, so these are templates; category names come from the dictionary and place
// names stay as written in Turkish (same approach as lib/region-copy.ts).
const PLACE: Record<Locale, (service: string, place: string) => string> = {
  // "Bodrum evden eve nakliyat" — the way people search; acronyms such as "SPK" keep their case.
  tr: (service, place) => `${place} ${/^.\p{Ll}/u.test(service) ? service.charAt(0).toLocaleLowerCase("tr") + service.slice(1) : service}`,
  de: (service, place) => `${service} in ${place}`,
  fr: (service, place) => `${service} à ${place}`,
  en: (service, place) => `${service} in ${place}`,
  ar: (service, place) => `${service} في ${place}`,
  fa: (service, place) => `${service} در ${place}`,
  ru: (service, place) => `${service}: ${place}`,
  nl: (service, place) => `${service} in ${place}`,
  es: (service, place) => `${service} en ${place}`,
  it: (service, place) => `${service} a ${place}`,
};
const COUNTRY: Record<Locale, (service: string) => string> = {
  tr: (service) => `${service} firmaları`, de: (service) => `${service} in der Türkei`, fr: (service) => `${service} en Turquie`, en: (service) => `${service} in Türkiye`,
  ar: (service) => `${service} في تركيا`, fa: (service) => `${service} در ترکیه`, ru: (service) => `${service} в Турции`, nl: (service) => `${service} in Turkije`,
  es: (service) => `${service} en Turquía`, it: (service) => `${service} in Turchia`,
};

export const serviceName = (slug: string, locale: Locale) => translate(serviceCategory(slug)?.name || slug, locale);

/** H1 and page title: "Bodrum evden eve nakliyat", "Removals in Bodrum"; without a place, the whole country ("Tesisatçı firmaları"). */
export function serviceHeading(slug: string, locale: Locale, place?: string | null) {
  return place ? PLACE[locale](serviceName(slug, locale), place) : COUNTRY[locale](serviceName(slug, locale));
}

const DESCRIPTION: Record<Locale, [firms: string, empty: string]> = {
  tr: ["estatemarket24'te onaylı {count} firma. Hizmet bölgelerini, iş fotoğraflarını ve iletişim bilgilerini inceleyin.", "Bu bölgede henüz onaylı firma yok. Hizmet veriyorsanız firmanızı ücretsiz ekleyin."],
  de: ["{count} geprüfte Firmen auf estatemarket24. Einsatzgebiete, Arbeitsfotos und Kontaktdaten ansehen.", "Hier gibt es noch keine geprüfte Firma. Bieten Sie diesen Service an? Tragen Sie Ihre Firma kostenlos ein."],
  fr: ["{count} entreprises vérifiées sur estatemarket24. Zones d’intervention, photos de réalisations et coordonnées.", "Aucune entreprise vérifiée ici pour le moment. Vous proposez ce service ? Ajoutez votre entreprise gratuitement."],
  en: ["{count} approved firms on estatemarket24. See service areas, work photos and contact details.", "No approved firm here yet. Do you offer this service? Add your firm for free."],
  ar: ["{count} شركات معتمدة على estatemarket24. اطلع على مناطق الخدمة وصور الأعمال وبيانات التواصل.", "لا توجد شركة معتمدة هنا بعد. هل تقدم هذه الخدمة؟ أضف شركتك مجانًا."],
  fa: ["{count} شرکت تأییدشده در estatemarket24. مناطق خدمت، عکس کارها و اطلاعات تماس را ببینید.", "هنوز شرکت تأییدشده‌ای در اینجا نیست. این خدمت را ارائه می‌دهید؟ شرکت خود را رایگان ثبت کنید."],
  ru: ["Проверенных компаний на estatemarket24: {count}. Районы работы, фото работ и контакты.", "Здесь пока нет проверенных компаний. Оказываете эту услугу? Добавьте компанию бесплатно."],
  nl: ["{count} goedgekeurde bedrijven op estatemarket24. Bekijk werkgebieden, foto’s van projecten en contactgegevens.", "Hier is nog geen goedgekeurd bedrijf. Biedt u deze dienst aan? Voeg uw bedrijf gratis toe."],
  es: ["{count} empresas aprobadas en estatemarket24. Consulta las zonas de servicio, las fotos de trabajos y los datos de contacto.","Todavía no hay empresas aprobadas en esta zona. ¿Ofreces este servicio? Añade tu empresa gratis."],
  it: ["{count} aziende approvate su estatemarket24. Scopri le aree servite, le foto dei lavori e i recapiti.","Non ci sono ancora aziende approvate in questa zona. Offri questo servizio? Aggiungi gratuitamente la tua azienda."],
};

/** Meta description: the heading, then the real firm count (or an invitation to firms). */
export function serviceDescription(heading: string, count: number, locale: Locale) {
  const [firms, empty] = DESCRIPTION[locale];
  return `${heading}. ${count > 0 ? firms.replace("{count}", String(count)) : empty}`.slice(0, 200);
}

export type ServiceCrumb = { name: string; path: string };
/** Ana sayfa › Hizmetler › category › province › district (page breadcrumb and BreadcrumbList). */
export function serviceCrumbs(scope: { category?: string; city?: string; district?: string }, locale: Locale): ServiceCrumb[] {
  const crumbs: ServiceCrumb[] = [{ name: translate("Ana sayfa", locale), path: "/" }, { name: translate("Hizmetler", locale), path: SERVICE_BASE }];
  if (!scope.category) return crumbs;
  crumbs.push({ name: serviceName(scope.category, locale), path: servicePath(scope.category) });
  if (scope.city) crumbs.push({ name: scope.city, path: servicePath(scope.category, scope.city) });
  if (scope.city && scope.district) crumbs.push({ name: scope.district, path: servicePath(scope.category, scope.city, scope.district) });
  return crumbs;
}
