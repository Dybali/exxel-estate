import { ServiceFooter } from "@/components/ServiceFooter";
import { ServiceHeader } from "@/components/ServiceHeader";

// The service directory is a sub-site: its own header and footer instead of the real-estate frame,
// which components/SiteFrame.tsx leaves out for /hizmetler (lib/site-chrome.ts). The root layout
// still provides <html>, metadata, language and cookie consent.
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <div className="svc-site"><ServiceHeader/>{children}<ServiceFooter/></div>;
}
