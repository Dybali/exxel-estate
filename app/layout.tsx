import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://excell-estate.blue-grape-8839.chatgpt.site"),
  title: "Excell Estate | Türkiye'de Seçkin Gayrimenkuller",
  description: "Türkiye'deki seçkin satılık ve kiralık daire, villa ve yaşam alanlarını Excell Estate ile keşfedin.",
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
      <body><Header/>{children}<Footer/></body>
    </html>
  );
}
