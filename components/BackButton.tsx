"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// "Geri" on every page except the home pages (owner's request 2026-11-17: easy moves between pages).
// It goes to the previous page of this site when there is one in this tab, otherwise one level up
// (/ilan/123 → /ilan → home), so it never leaves the site.
const KEY = "em24_page_views";
const HOMES = new Set(["/", "/hizmetler", "/muteahhitler"]);

function views(): number {
  try { return Number(sessionStorage.getItem(KEY)) || 0; } catch { return 0; }
}
function setViews(value: number) {
  try { sessionStorage.setItem(KEY, String(Math.max(0, value))); } catch { /* private window: fall back to the parent page */ }
}

// Folders without a page of their own lead to the nearest list.
const NO_PAGE: Record<string, string> = { "/ilan": "/ilanlar", "/ilan-duzenle": "/hesabim", "/profil": "/danismanlar", "/hizmetler/firma": "/hizmetler", "/muteahhitler/firma": "/muteahhitler" };
export function parentPath(path: string): string {
  const parts = path.split(/[?#]/)[0].split("/").filter(Boolean);
  parts.pop();
  const parent = parts.length ? `/${parts.join("/")}` : "/";
  return NO_PAGE[parent] || parent;
}

export function BackButton({ className = "" }: { className?: string }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const { t } = useLocale();
  // Count the pages this tab has opened on the site (a reload keeps the count, a new tab starts at 0).
  useEffect(() => { setViews(views() + 1); }, [path]);
  if (HOMES.has(path.replace(/\/+$/, "") || "/")) return null;
  const back = () => {
    const count = views();
    const fromSite = (() => { try { return Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch { return false; } })();
    if (count > 1 || (fromSite && window.history.length > 1)) {
      // The page we return to counts itself again on arrival.
      setViews(count - 2);
      router.back();
    } else {
      router.push(parentPath(path));
    }
  };
  return <div className={`page-back-row ${className}`.trim()}><div className="container">
    <button type="button" className="page-back" onClick={back} title={t("Önceki sayfaya dön")}><ArrowLeft size={16} aria-hidden="true"/>{t("Geri")}</button>
  </div></div>;
}
