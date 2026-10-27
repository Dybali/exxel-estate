import { CompanyProfile } from "@/components/CompanyProfile";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyProfile id={id}/>;
}
