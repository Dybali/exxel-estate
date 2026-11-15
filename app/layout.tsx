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
import "./admin-insights.css";
import "./company-portfolio.css";
import "./company-team.css";
import "./projects.css";
import "./security.css";
import "./pages.css";
import "./brand-colors.css";
import "./buttons.css";
import "./listing-insights.css";
import "./region-pages.css";
import "./services.css";
import "./contractors.css";
import "./map-features.css";
import "./ai-search.css";
import "./feedback.css";
import "./legal.css";
import "./polish.css";
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
import { CurrencyProvider } from "@/components/DisplayCurrency";
import { currencyFromCookies } from "@/lib/display-currency";
import { requestRates } from "@/lib/tcmb-server";
import { headers } from "next/headers";
import { ServiceWorker } from "@/components/ServiceWorker";
import { isRtl } from "@/lib/i18n-dictionary";
import { languageAlternates, localizedUrl, requestLocale, requestPath, siteUrl } from "@/lib/request-context";
import { privatePage, seoCopy } from "@/lib/seo-copy";
import { shareMetadata } from "@/lib/share-metadata";
import { jsonLd, siteStructuredData } from "@/lib/structured-data";

export const viewport: Viewport = { themeColor: "#0B5F63" };

export async function generateMetadata(): Promise<Metadata> {
  const [locale, path] = await Promise.all([requestLocale(), requestPath()]);
  // Public pages listed in seoCopy get their own title, canonical and hreflang. Private pages (sign-in,
  // account, forms, administration) get their own title and are never indexed. Any other path keeps
  // the plain brand name and no canonical: pages with their own metadata set both, and a 404 must not
  // claim the home page's title or point a canonical at itself.
  const known = seoCopy[path]?.[locale], hidden = privatePage(path);
  const title = hidden ? `${hidden.title[locale]} | estatemarket24` : known?.[0] || "estatemarket24";
  const description = hidden ? undefined : known?.[1];
  const verification = googleSiteVerification();
  return {
    metadataBase: new URL(siteUrl()),
    title,
    ...(description ? { description } : {}),
    ...(hidden ? { robots: { index: false, follow: hidden.follow } } : known ? { alternates: { canonical: localizedUrl(path, locale), languages: languageAlternates(path) } } : {}),
    // Default link preview; pages with their own title or image call shareMetadata themselves.
    ...shareMetadata({ title, description, path, locale }),
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
  // Display currency of listing prices: the visitor's explicit choice (cookie) and one TCMB snapshot per request.
  const [locale, rates, requestHeaders] = await Promise.all([requestLocale(), requestRates(), headers()]);
  const currency = currencyFromCookies(requestHeaders.get("cookie"));
  const gaId = gaMeasurementId();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteStructuredData(siteUrl())) }}/><LocaleProvider initialLocale={locale}><CurrencyProvider initialRates={rates} initialCurrency={currency}><CookieConsentProvider googleAnalytics={Boolean(gaId)}><SiteFrame>{children}</SiteFrame>{gaId&&<GoogleAnalytics id={gaId}/>}</CookieConsentProvider></CurrencyProvider></LocaleProvider><ServiceWorker/></body>
    </html>
  );
}
