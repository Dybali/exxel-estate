"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Mail, UserRound } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { ServiceFirmPanel } from "./ServiceFirmPanel";
import { ContractorPanel } from "./ContractorPanel";

// The firm's own panel inside its sub-site (owner's request 2026-11-13): /hizmetler/panel for service firms and
// /muteahhitler/panel for contractors, under that sub-site's header. Messages and account settings stay in Hesabım.
type Account = { email_verified?: number; accountKind?: string };
export function FirmPanelPage({ kind }: { kind: "service" | "contractor" }) {
  const { t } = useLocale();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const here = kind === "service" ? "/hizmetler/panel" : "/muteahhitler/panel";
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then((response) => response.json() as Promise<{ user?: Account }>).then((data) => {
      const user = data.user || null;
      if (!user) { window.location.replace(`/giris?mode=register&role=${kind}&next=${encodeURIComponent(here + window.location.search)}`); return; }
      if (!user.email_verified) { window.location.replace("/eposta-dogrula"); return; }
      setAccount(user);
    }).catch(() => setAccount(null));
  }, [kind, here]);
  if (account === undefined) return <main className="container section firm-panel-page"><p>{t("Yükleniyor...")}</p></main>;
  if (!account) return <main className="container section firm-panel-page"><p className="form-error" role="alert">{t("Hesap bilgileri yüklenemedi.")}</p></main>;
  if (account.accountKind !== kind) return <main className="container section firm-panel-page">
    <div className="panel-empty">
      <h2>{t(kind === "service" ? "Bu panel hizmet firması hesapları içindir." : "Bu panel müteahhit hesapları içindir.")}</h2>
      <p>{t("Hesap türünüzü Hesabım › Profilim › Hesap türü bölümünden değiştirebilirsiniz. Emlakçı hesapları firma paneli açamaz.")}</p>
      <Link className="small-primary" href="/hesabim?tab=profil">{t("Hesap türünü değiştir")}</Link>
    </div>
  </main>;
  return <main className="container section firm-panel-page">
    <nav className="firm-panel-links" aria-label={t("Hesabım")}>
      <Link href="/hesabim?tab=mesajlar"><Mail size={16} aria-hidden="true"/>{t("Mesajlar")}</Link>
      <Link href="/hesabim?tab=profil"><UserRound size={16} aria-hidden="true"/>{t("Hesap ayarları")}</Link>
    </nav>
    {kind === "service" ? <ServiceFirmPanel/> : <ContractorPanel/>}
  </main>;
}
