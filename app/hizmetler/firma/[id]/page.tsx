import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ServiceFirmProfile } from "@/components/ServiceFirmProfile";
import { translate } from "@/lib/i18n-dictionary";
import { localizedUrl, pageAlternates, requestLocale } from "@/lib/request-context";
import { serviceCategory } from "@/lib/service-categories";
import { serviceName } from "@/lib/service-copy";
import { fillWithSamples, isSampleFirmId, sampleFirmById, similarSampleFirms } from "@/lib/service-samples";
import { firmById, firmDescription, firmPath, SERVICE_SIMILAR_LIMIT, similarFirms, validFirmId, type ServiceFirm } from "@/lib/services";
import { serviceActor, serviceSamples, servicesDB } from "@/lib/services-server";
import { currentUser } from "@/lib/server";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

// Approved firms for everyone; the owner and administrators may preview any status (never indexed).
// /hizmetler/firma/sample-… is a code-only sample (lib/service-samples.ts): noindex, no contact, no
// structured data; a 404 once SERVICE_SAMPLES is switched off.
const load = cache(async (id: string) => {
  if (isSampleFirmId(id)) return sampleFirmById(serviceSamples(), id);
  if (!validFirmId(id)) return null;
  const visible = await firmById(servicesDB(), id);
  if (visible) return visible;
  const user = await currentUser(new Request("https://site.internal/", { headers: await headers() })).catch(() => null);
  return user ? firmById(servicesDB(), id, serviceActor(user)) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params, firm = await load(id), locale = await requestLocale();
  if (!firm) return { title: `${translate("Sayfa bulunamadı", locale)} | estatemarket24`, robots: { index: false, follow: false } };
  const path = firmPath(firm.id), services = firm.categories.slice(0, 2).map((slug) => serviceName(slug, locale)).join(", ");
  const title = `${firm.name} · ${services}`, description = firmDescription(firm, locale).replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${title} | estatemarket24`, description,
    alternates: await pageAlternates(path),
    ...(firm.sample ? { robots: { index: false, follow: true } } : firm.status === "approved" ? {} : { robots: { index: false, follow: false } }),
    ...shareMetadata({ title, description, path, locale, image: coverShareImage(firm.cover || firm.photos[0] || firm.logo, firm.name) }),
  };
}

export default async function ServiceFirmPage({ params }: Props) {
  const { id } = await params, firm = await load(id);
  if (!firm) notFound();
  const locale = await requestLocale(), url = localizedUrl(firmPath(firm.id), locale);
  // Real similar firms first, then samples up to the same limit.
  const real = await similarFirms(servicesDB(), firm).catch(() => [] as ServiceFirm[]);
  const similar = fillWithSamples(real, similarSampleFirms(serviceSamples(), firm), SERVICE_SIMILAR_LIMIT);
  // Legal and financial advice firms are ProfessionalService; trades and the rest LocalBusiness.
  const professional = firm.categories.every((slug) => serviceCategory(slug)?.group === "hukuk-finans");
  const structured = firm.status !== "approved" || firm.sample ? null : {
    "@context": "https://schema.org", "@type": professional ? "ProfessionalService" : "LocalBusiness", "@id": url, url, name: firm.name,
    description: firmDescription(firm, locale).slice(0, 500), telephone: firm.phone,
    ...(firm.email ? { email: firm.email } : {}), ...(firm.website ? { sameAs: [firm.website] } : {}),
    ...(firm.logo ? { logo: localizedUrl(firm.logo, "tr"), image: localizedUrl(firm.cover || firm.logo, "tr") } : firm.cover ? { image: localizedUrl(firm.cover, "tr") } : {}),
    areaServed: firm.areas.map((area) => area.district ? { "@type": "City", name: `${area.district}, ${area.city}` } : { "@type": "AdministrativeArea", name: area.city }),
    knowsAbout: firm.categories.map((slug) => serviceName(slug, locale)),
  };
  return <>
    {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>}
    <ServiceFirmProfile firm={firm} similar={similar}/>
  </>;
}
