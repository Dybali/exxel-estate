import type { Metadata } from "next";
import { FirmPanelPage } from "@/components/FirmPanelPage";
import { translate } from "@/lib/i18n-dictionary";
import { requestLocale } from "@/lib/request-context";

export const dynamic = "force-dynamic";
// The firm's own panel inside its sub-site (components/FirmPanelPage.tsx); private, never indexed.
export async function generateMetadata(): Promise<Metadata> {
  return { title: `${translate("Firma panelim", await requestLocale())} | estatemarket24`, robots: { index: false, follow: false } };
}
export default function Page() { return <FirmPanelPage kind="service"/>; }
