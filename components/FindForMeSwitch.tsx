"use client";
import "@/app/find-for-me.css";
import Link from "@/components/SafeLink";
import { HardHat, House, Wrench } from "lucide-react";
import { useLocale } from "@/lib/i18n";

/** The three "Benim için bul" services (owner's request 2026-11-24): a home (estate agents answer, lib/home-requests.ts),
 * a service firm (lib/services.ts quotes) and a contractor (lib/contractors.ts land and construction requests). */
export const FIND_FOR_ME = [
  { id: "ev", href: "/benim-icin-bul", label: "Ev bul", icon: House },
  { id: "hizmet", href: "/hizmetler/teklif-iste", label: "Hizmet bul", icon: Wrench },
  { id: "muteahhit", href: "/muteahhitler/kat-karsiligi?tur=insaat", label: "Müteahhit bul", icon: HardHat },
] as const;
export type FindForMeId = typeof FIND_FOR_ME[number]["id"];

/** Switch between the three request forms, shown at the top of each. */
export function FindForMeSwitch({ active }: { active: FindForMeId }) {
  const { t } = useLocale();
  return <nav className="ffm-switch" aria-label={t("Benim için bul")}>
    <span>{t("Benim için bul")}</span>
    {FIND_FOR_ME.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} className={id === active ? "active" : ""} aria-current={id === active ? "page" : undefined}><Icon size={16} aria-hidden="true"/>{t(label)}</Link>)}
  </nav>;
}
