import { ImageResponse } from "next/og";
import { isLocale, translate, type Locale } from "@/lib/i18n-dictionary";
import { localizedListingText } from "@/lib/listing-seo";
import { typeLabel } from "@/lib/listings";
import { pricePeriod, purposeLabel } from "@/lib/property-categories";
import { listingById } from "@/lib/server";
import { SHARE_FONT_BASE64, SHARE_FONT_NAME, SHARE_LOGO_SVG } from "@/lib/share-image-assets";
import { sharePrice } from "@/lib/share-image-policy";

// Branded 1200x630 link preview card for a listing (second og:image after the first photo, or the only
// one without photos; see lib/share-image-policy.ts). Rendered with next/og, which works in the Cloudflare
// Worker (vinext) and on the Node server. If rendering fails the request is redirected to the default
// share image, so a preview never breaks.
export const dynamic = "force-dynamic";

const PETROL = "#0b5f63", GOLD = "#f2b84b", INK = "#10282a", MUTED = "#4b6466";
let fontData: ArrayBuffer | null = null;
const font = () => (fontData ??= Uint8Array.from(atob(SHARE_FONT_BASE64), (c) => c.charCodeAt(0)).buffer);
const svg = (markup: string) => `data:image/svg+xml;base64,${btoa(markup)}`;
const logo = svg(SHARE_LOGO_SVG);
const signet = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 60 60" width="60" height="60"><path d="M19.5 16.5H44.5V21.5H24.5V42.5H44.5V47.5H19.5Z" fill="#ffffff" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><rect x="29" y="28" width="13" height="8" rx="2.5" fill="#f2b84b"/></svg>');
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);
const fallback = () => new Response(null, { status: 302, headers: { Location: "/og-default.png", "Cache-Control": "public, max-age=300" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, lang = new URL(request.url).searchParams.get("lang");
  const listing = await listingById(id).catch(() => undefined);
  if (listing === undefined) return fallback();
  if (!listing || (listing.source !== "demo" && listing.status !== "published")) return new Response(null, { status: 404 });
  // The embedded font has Latin and Cyrillic letters only: Arabic and Persian cards use English labels.
  const locale: Locale = isLocale(lang) ? (lang === "ar" || lang === "fa" ? "en" : lang) : "tr";
  const t = (key: string) => translate(key, locale);
  const title = clip(localizedListingText(listing, locale).title, 90);
  const place = [listing.district, listing.city].filter(Boolean).join(", ");
  const period = pricePeriod(listing.purpose);
  const badges = [t(purposeLabel(listing.purpose)), t(typeLabel(listing.propertyType)), ...(listing.source === "demo" ? [t("Örnek ilan")] : [])];
  try {
    const image = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: SHARE_FONT_NAME }}>
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ width: 420, height: 534, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${PETROL} 0%, #084a4d 100%)` }}>
            <img src={signet} width={200} height={200} alt=""/>
          </div>
          <div style={{ width: 780, height: 534, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 56px 44px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {badges.map((badge, index) => <div key={badge} style={{ display: "flex", padding: "8px 20px", marginRight: 12, marginBottom: 12, borderRadius: 999, fontSize: 24, background: index === 0 ? GOLD : "#e7f1f1", color: index === 0 ? "#3a2a05" : PETROL }}>{badge}</div>)}
              </div>
              <div style={{ display: "block", marginTop: 20, fontSize: 50, lineHeight: 1.15, color: INK, lineClamp: 3 }}>{title}</div>
              {place && <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: MUTED }}>{place}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", color: PETROL }}>
              <div style={{ fontSize: 64 }}>{sharePrice(listing.price, listing.currency, locale)}</div>
              {period && <div style={{ fontSize: 30, marginLeft: 14, color: MUTED }}>{t(period)}</div>}
            </div>
          </div>
        </div>
        <div style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", background: PETROL }}>
          <img src={logo} width={302} height={56} alt=""/>
          <div style={{ width: 120, height: 8, borderRadius: 4, background: GOLD }}/>
        </div>
      </div>,
      { width: 1200, height: 630, fonts: [{ name: SHARE_FONT_NAME, data: font(), weight: 400, style: "normal" }] },
    );
    // Render completely here so a failure can still fall back to the default image.
    const png = await image.arrayBuffer();
    return new Response(png, { headers: {
      "Content-Type": "image/png",
      // The URL carries a version of the listing (?v=, lib/share-image-policy.ts), so it can be cached long.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    } });
  } catch (cause) {
    console.error("share_image_failed", id, String(cause));
    return fallback();
  }
}
