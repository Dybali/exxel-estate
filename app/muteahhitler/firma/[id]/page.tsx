import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ContractorProfile } from "@/components/ContractorProfile";
import { translate } from "@/lib/i18n-dictionary";
import { localizedUrl, pageAlternates, requestLocale } from "@/lib/request-context";
import { isSampleContractorId, sampleContractorById } from "@/lib/contractor-samples";
import { contractorById, contractorListings, contractorOwnerId, contractorPath, specialtyName, validContractorId, type ContractorListing } from "@/lib/contractors";
import { contractorActor, contractorSamples, contractorsDB } from "@/lib/contractors-server";
import { currentUser } from "@/lib/server";
import { firmThreadInfo } from "@/lib/firm-plans-server";
import { firmThreadKey } from "@/lib/firm-plans";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

// Approved firms for everyone; the owner and administrators may preview any status (never indexed).
// /muteahhitler/firma/sample-… is a code-only sample: noindex, no contact, no structured data.
const load = cache(async (id: string) => {
  if (isSampleContractorId(id)) return sampleContractorById(contractorSamples(), id);
  if (!validContractorId(id)) return null;
  const visible = await contractorById(contractorsDB(), id);
  if (visible) return visible;
  const user = await currentUser(new Request("https://site.internal/", { headers: await headers() })).catch(() => null);
  return user ? contractorById(contractorsDB(), id, contractorActor(user)) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params, firm = await load(id), locale = await requestLocale();
  if (!firm) return { title: `${translate("Sayfa bulunamadı", locale)} | estatemarket24`, robots: { index: false, follow: false } };
  const path = contractorPath(firm.id), kinds = firm.specialties.slice(0, 2).map((slug) => translate(specialtyName(slug), locale)).join(", ");
  const title = `${firm.name} · ${translate("Müteahhit", locale)} · ${kinds}`, description = firm.description.replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${title} | estatemarket24`, description, alternates: await pageAlternates(path),
    ...(firm.sample ? { robots: { index: false, follow: true } } : firm.status === "approved" ? {} : { robots: { index: false, follow: false } }),
    ...shareMetadata({ title, description, path, locale, image: coverShareImage(firm.cover || firm.projects[0]?.photos[0] || firm.logo, firm.name) }),
  };
}

export default async function ContractorPage({ params }: Props) {
  const { id } = await params, firm = await load(id);
  if (!firm) notFound();
  const locale = await requestLocale(), url = localizedUrl(contractorPath(firm.id), locale);
  // The owner's approved housing projects on /projeler.
  const ownerId = firm.sample ? null : await contractorOwnerId(contractorsDB(), firm.id).catch(() => null);
  // "Mesaj gönder" only when the firm's package includes messaging (lib/firm-plans.ts).
  const messaging = !firm.sample && Boolean((await firmThreadInfo(firmThreadKey("contractor", firm.id)).catch(() => null))?.messaging);
  const listings = ownerId ? await contractorListings(contractorsDB(), ownerId).catch(() => [] as ContractorListing[]) : [];
  const structured = firm.status !== "approved" || firm.sample ? null : {
    "@context": "https://schema.org", "@type": "GeneralContractor", "@id": url, url, name: firm.name, description: firm.description.slice(0, 500), telephone: firm.phone,
    ...(firm.email ? { email: firm.email } : {}), ...(firm.website ? { sameAs: [firm.website] } : {}), ...(firm.foundedYear ? { foundingDate: String(firm.foundedYear) } : {}),
    ...(firm.logo ? { logo: localizedUrl(firm.logo, "tr") } : {}), ...(firm.cover ? { image: localizedUrl(firm.cover, "tr") } : {}),
    areaServed: firm.areas.map((area) => area.district ? { "@type": "City", name: `${area.district}, ${area.city}` } : { "@type": "AdministrativeArea", name: area.city }),
    knowsAbout: firm.specialties.map((slug) => translate(specialtyName(slug), locale)),
  };
  return <>
    {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>}
    <ContractorProfile firm={firm} listings={listings} messaging={messaging}/>
  </>;
}
