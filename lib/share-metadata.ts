import type { Metadata } from "next";
import { locales, type Locale } from "./i18n-dictionary";
import { openGraphLocale } from "./seo-copy";
import { localizedUrl, siteUrl } from "./request-context";
import { absoluteShareUrl, DEFAULT_SHARE_IMAGE, type ShareImage } from "./share-image-policy";

export { DEFAULT_SHARE_IMAGE, type ShareImage };

// Open Graph and Twitter/X tags for link previews (WhatsApp, Facebook, Telegram, X, LinkedIn).
// Next.js replaces a parent's openGraph/twitter object instead of merging it, so every page that sets
// its own preview passes the complete set through this helper. Image URLs are absolute (SITE_URL).
export function shareMetadata({ title, description, path, locale, image = DEFAULT_SHARE_IMAGE, article }: {
  title: string; description?: string; path: string; locale: Locale; image?: ShareImage | ShareImage[]; article?: { publishedTime?: string };
}): Pick<Metadata, "openGraph" | "twitter"> {
  const base = siteUrl(), images = (Array.isArray(image) ? image : [image]).map((item) => ({ ...item, url: absoluteShareUrl(item.url, base) })), [first] = images;
  const common = {
    siteName: "estatemarket24", title, description, url: localizedUrl(path, locale), images,
    locale: openGraphLocale[locale], alternateLocale: locales.filter((item) => item.code !== locale).map((item) => openGraphLocale[item.code]),
  };
  return {
    openGraph: article ? { ...common, type: "article", ...article } : { ...common, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [{ url: first.url, ...(first.alt ? { alt: first.alt } : {}) }] },
  };
}
