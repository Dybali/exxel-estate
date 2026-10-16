import type { Metadata } from "next";
import "./globals.css";
import "./market-refresh.css";
import "./messaging.css";
import "./property-detail.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LocaleProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://exxel-estate.blue-grape-8839.chatgpt.site"),
  title: "salesorrent | Türkiye'de Seçkin Gayrimenkuller",
  description: "Türkiye'deki seçkin satılık ve kiralık daire, villa ve yaşam alanlarını salesorrent ile keşfedin.",
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
      <body><LocaleProvider><Header/>{children}<Footer/></LocaleProvider></body>
    </html>
  );
}



