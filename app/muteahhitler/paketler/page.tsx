import type { Metadata } from "next";
import { FirmPlans } from "@/components/FirmPlans";
import { plansSwitchedOn } from "@/lib/firm-plans-server";
import { translate } from "@/lib/i18n-dictionary";
import { pageAlternates, requestLocale } from "@/lib/request-context";

export const dynamic = "force-dynamic";
// Packages for contractors (lib/firm-plans.ts, docs/firm-plans.md).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return { title: `${translate("Müteahhitler için paketler", locale)} | estatemarket24`, description: translate("Kayıt ücretsiz. İş başına veya teklif başına ücret yok, yalnızca sabit aylık paket.", locale), alternates: await pageAlternates("/muteahhitler/paketler") };
}
export default function Page() { return <FirmPlans kind="contractor" enabled={plansSwitchedOn()}/>; }
