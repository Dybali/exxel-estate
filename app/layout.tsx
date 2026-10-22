import type { Metadata } from "next";
import "./globals.css";
import "./market-refresh.css";
import "./home-premium.css";
import "./messaging.css";
import "./property-detail.css";
import "./interior-refresh.css";
import "./account-features.css";
import "leaflet/dist/leaflet.css";
import "./discovery.css";
import "./seller-profile.css";
import "./email-recovery.css";
import "./listing-tools.css";
import "./panoramas.css";
import "./immersive-tour.css";
import "./tour-capture.css";
import "./reporting.css";
import "./office-verification.css";
import "./assistant.css";
import "./editorial.css";
import "./categories-statistics.css";
import "./cookies-company.css";
import {CookieConsentProvider} from "@/components/CookieConsent";
import {AssistantLauncher} from "@/components/AssistantLauncher";
import {CompareTray} from "@/components/Compare";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppPrompt } from "@/components/WhatsAppPrompt";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://exxel-estate.blue-grape-8839.chatgpt.site"),
  title: "estatemarket24 | Türkiye'de Seçkin Gayrimenkuller",
  description: "Türkiye'deki seçkin satılık ve kiralık daire, villa ve yaşam alanlarını estatemarket24 ile keşfedin.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body><LocaleProvider><CookieConsentProvider><Header/><WhatsAppPrompt/>{children}<CompareTray/><AssistantLauncher/><Footer/></CookieConsentProvider></LocaleProvider></body>
    </html>
  );
}
