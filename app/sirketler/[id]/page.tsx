import type { Metadata } from "next";
import { CompanyProfile } from "@/components/CompanyProfile";
import { companySummary } from "@/lib/company-seo";
import { pageAlternates } from "@/lib/request-context";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const company = await companySummary(id).catch(() => null);
  return { ...(company ? { title: `${company.name} | estatemarket24` } : {}), alternates: await pageAlternates(`/sirketler/${id}`) };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyProfile id={id}/>;
}
