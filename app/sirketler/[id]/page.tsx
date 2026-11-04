import type { Metadata } from "next";
import { CompanyProfile } from "@/components/CompanyProfile";
import { companySummary } from "@/lib/company-seo";
import { PUBLIC_DEMO_COMPANIES } from "@/lib/demo-companies";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { seoCopy } from "@/lib/seo-copy";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const path = `/sirketler/${id}`, locale = await requestLocale();
  // Labelled sample developers have a cover photo; real company profiles have none yet (default image).
  const sample = PUBLIC_DEMO_COMPANIES.find((company) => company.id === id);
  const company = sample || await companySummary(id).catch(() => null);
  if (!company) return { alternates: await pageAlternates(path) };
  const description = sample?.description?.slice(0, 160) || seoCopy["/sirketler"][locale][1];
  return {
    title: `${company.name} | estatemarket24`, description,
    alternates: await pageAlternates(path),
    ...shareMetadata({ title: company.name, description, path, locale, image: coverShareImage(sample?.coverUrl, company.name) }),
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyProfile id={id}/>;
}
