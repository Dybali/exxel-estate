import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./market-refresh.css";
import "./home-premium.css";
import "./developer-showcase.css";
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
import "./launch-polish.css";
import "./exchange-rates.css";
import "./rounded-search.css";
import "./mobile-ux.css";
import "./brand-refresh.css";
import "./listing-entry.css";
import "./fixed-exchange.css";
import "./company-directory-list.css";
import "./foreign-buyer-guide.css";
import "./admin-workspace.css";
import "./company-portfolio.css";
import "./company-team.css";
import "./projects.css";
import "./security.css";
import "./pages.css";
import "./brand-colors.css";
import {CookieConsentProvider} from "@/components/CookieConsent";
import {GoogleAnalytics} from "@/components/GoogleAnalytics";
import {gaMeasurementId,googleSiteVerification} from "@/lib/analytics";
import {AssistantLauncher} from "@/components/AssistantLauncher";
import {CompareTray} from "@/components/Compare";
import {SiteFrame} from "@/components/SiteFrame";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppPrompt } from "@/components/WhatsAppPrompt";
import { LocaleProvider } from "@/lib/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import { isRtl } from "@/lib/i18n-dictionary";
import { languageAlternates, localizedUrl, requestLocale, requestPath, siteUrl } from "@/lib/request-context";
import { openGraphLocale, seoCopy } from "@/lib/seo-copy";

export const viewport: Viewport = { themeColor: "#0B5F63" };

export async function generateMetadata(): Promise<Metadata> {
  const [locale, path] = await Promise.all([requestLocale(), requestPath()]);
  const [title, description] = (seoCopy[path] || seoCopy["/"])[locale];
  const verification = googleSiteVerification();
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: { canonical: localizedUrl(path, locale), languages: languageAlternates(path) },
    openGraph: { siteName: "estatemarket24", locale: openGraphLocale[locale], type: "website", title, description, url: localizedUrl(path, locale) },
    icons: {
      icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/favicon.svg" }],
      shortcut: "/icons/icon-192.png",
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: { capable: true, title: "estatemarket24", statusBarStyle: "default" },
    manifest: "/manifest.webmanifest",
    // Google Search Console ownership meta tag (GOOGLE_SITE_VERIFICATION), only when set.
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await requestLocale();
  const gaId = gaMeasurementId();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body><LocaleProvider initialLocale={locale}><CookieConsentProvider googleAnalytics={Boolean(gaId)}><SiteFrame>{children}</SiteFrame>{gaId&&<GoogleAnalytics id={gaId}/>}</CookieConsentProvider></LocaleProvider><ServiceWorker/></body>
    </html>
  );
}
