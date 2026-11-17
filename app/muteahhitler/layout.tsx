import { BackButton } from "@/components/BackButton";
import { ContractorFooter, ContractorHeader } from "@/components/ContractorChrome";
import { FeedbackWidget } from "@/components/FeedbackWidget";

// The contractor directory is a sub-site like /hizmetler: its own header and footer instead of the
// real-estate frame (components/SiteFrame.tsx leaves it out, lib/site-chrome.ts). It reuses the
// service sub-site styles (svc-*, service-*) with a few additions in app/contractors.css.
export default function ContractorsLayout({ children }: { children: React.ReactNode }) {
  return <div className="svc-site ctr-site"><ContractorHeader/><BackButton className="svc-back-row"/>{children}<ContractorFooter/><FeedbackWidget/></div>;
}
