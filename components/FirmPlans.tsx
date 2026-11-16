"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { TransferDetails } from "@/components/Orders";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { FIRM_LIMITS, FIRM_PRICES, FIRM_TIERS, type FirmKind, type FirmTier } from "@/lib/firm-plans";
import type { Order } from "@/lib/orders";
import type { BankTransfer } from "@/lib/payment-providers";

// Packages for service firms (/hizmetler/paketler) and contractors (/muteahhitler/paketler), lib/firm-plans.ts.
// Bought through the order flow (bank transfer, confirmed by an administrator). The table is built from
// FIRM_LIMITS / FIRM_PRICES so the page and the limits the server applies cannot drift apart.
const TIER_NAMES: Record<FirmTier, string> = { free: "Ücretsiz", plus: "Plus", pro: "Pro" };
type Row = { label: string; value: (tier: FirmTier) => string | boolean };
const days = (n: number) => ({ 7: "7 gün", 30: "30 gün", 90: "90 gün" } as Record<number, string>)[n] || String(n);
const ROWS: Record<FirmKind, Row[]> = {
  service: [
    { label: "Firma profili, telefon ve WhatsApp", value: () => true },
    { label: "Fotoğraf", value: (tier) => String(FIRM_LIMITS.service[tier].photos) },
    { label: "Müşteriyle canlı çeviriyle mesajlaşma", value: (tier) => FIRM_LIMITS.service[tier].messaging },
    { label: "İstatistikler", value: (tier) => days(FIRM_LIMITS.service[tier].statsDays) },
    { label: "Aramalarda öne çıkma", value: (tier) => FIRM_LIMITS.service[tier].featured },
  ],
  contractor: [
    { label: "Firma profili, telefon ve WhatsApp", value: () => true },
    { label: "Tamamlanan proje", value: (tier) => String(FIRM_LIMITS.contractor[tier].projects) },
    { label: "Proje başına fotoğraf", value: (tier) => String(FIRM_LIMITS.contractor[tier].projectPhotos) },
    { label: "Arsa sahibi ve müşteriyle canlı çeviriyle mesajlaşma", value: (tier) => FIRM_LIMITS.contractor[tier].messaging },
    { label: "Kat karşılığı talepleri", value: (tier) => ({ none: false, delayed: "24 saat sonra", first: "Hemen" } as const)[FIRM_LIMITS.contractor[tier].land] },
    { label: "İstatistikler", value: (tier) => days(FIRM_LIMITS.contractor[tier].statsDays) },
    { label: "Aramalarda ve il sayfasında öne çıkma", value: (tier) => FIRM_LIMITS.contractor[tier].featured },
  ],
};
type Mine = { plan?: { tier: FirmTier; endsAt: string | null; enabled: boolean } };
type Orders = { orders: Order[]; bank: BankTransfer | null };

export function FirmPlans({ kind, enabled }: { kind: FirmKind; enabled: boolean }) {
  const { t, locale } = useLocale();
  const [yearly, setYearly] = useState(false), [account, setAccount] = useState<{ kind?: string } | null | undefined>(undefined);
  const [plan, setPlan] = useState<Mine["plan"] | null>(null), [orders, setOrders] = useState<Orders | null>(null);
  const [created, setCreated] = useState<{ reference: string; amount: number; currency: string } | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const here = kind === "service" ? "/hizmetler/paketler" : "/muteahhitler/paketler";
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then((response) => response.json() as Promise<{ user?: { accountKind?: string } }>).then((data) => {
      const user = data.user ? { kind: data.user.accountKind } : null;
      setAccount(user);
      if (user?.kind !== kind) return;
      fetch(kind === "service" ? "/api/services/mine" : "/api/contractors/mine", { cache: "no-store" }).then((response) => apiJson<Mine>(response)).then((mine) => setPlan(mine.plan || null)).catch(() => {});
      fetch("/api/orders", { cache: "no-store" }).then((response) => apiJson<Orders>(response)).then(setOrders).catch(() => {});
    }).catch(() => setAccount(null));
  }, [kind]);
  const item = (tier: Exclude<FirmTier, "free">) => `${kind}-${tier}${yearly ? "-year" : ""}`;
  const pending = orders?.orders.find((order) => order.status === "awaiting_payment" && String(order.item).startsWith(`${kind}-`));
  async function buy(tier: Exclude<FirmTier, "free">) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", item: item(tier) }) });
      const data = await apiJson<{ order?: { reference: string; amount: number; currency: string }; bank?: BankTransfer; error?: string }>(response);
      if (!response.ok || !data.order) throw new Error(data.error || "Sipariş oluşturulamadı.");
      setCreated(data.order); if (data.bank) setOrders((old) => ({ orders: old?.orders || [], bank: data.bank! }));
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
  const current = plan?.tier || "free";
  const cell = (value: string | boolean) => value === true ? <Check size={17} aria-label={t("Var")}/> : value === false ? <Minus size={17} aria-label={t("Yok")}/> : t(value);
  return <section className="container section firm-plans">
    <div className="pricing-heading">
      <span className="market-overline">{t(kind === "service" ? "HİZMET FİRMALARI" : "MÜTEAHHİTLER")}</span>
      <h1>{t("Paketler")}</h1>
      <p>{t("Kayıt ücretsiz. İş başına veya teklif başına ücret yok, yalnızca sabit aylık paket.")}</p>
    </div>
    <div className="pricing-example-notice"><ShieldCheck size={20}/><p><strong>{t("Canlı çeviriyle mesajlaşma")}</strong>{t("Müşteri kendi dilinde yazar, siz Türkçe okursunuz; cevabınızı müşteri kendi dilinde görür. Sitenin 8 dilinde çalışır.")}</p></div>
    {!enabled && <p className="project-editor-note firm-plans-off">{t("Paketler henüz zorunlu değil: şu an bütün firmalar ücretsiz olarak en geniş sınırlarla çalışır.")}</p>}
    <div className="admin-tabs firm-plans-period" role="group" aria-label={t("Ödeme dönemi")}>
      <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>{t("Aylık")}</button>
      <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>{t("Yıllık (2 ay ücretsiz)")}</button>
    </div>
    <div className="pricing-plan-grid">{FIRM_TIERS.map((tier) => {
      const price = tier === "free" ? 0 : FIRM_PRICES[kind][tier] * (yearly ? 10 : 1);
      const mine = account?.kind === kind && current === tier;
      return <article key={tier} className={`pricing-plan${tier === "plus" ? " pricing-plan-accent" : ""}`}>
        <h2>{t(TIER_NAMES[tier])}</h2>
        <div className="pricing-plan-price"><Money value={price} currency="TRY"/><small>{t(yearly ? "/ yıl" : "/ ay")}</small></div>
        {mine && <p className="firm-plans-current">{t("Mevcut paketiniz")}{plan?.endsAt && <> · {t("{date} tarihine kadar").replace("{date}", date(plan.endsAt))}</>}</p>}
        {tier !== "free" && (account === null
          ? <Link className="pricing-plan-cta" href={`/giris?mode=register&role=${kind}&next=${encodeURIComponent(here)}`}>{t("Ücretsiz kayıt ol")}</Link>
          : account?.kind === kind ? <button type="button" className="pricing-plan-cta" disabled={busy || Boolean(pending) || Boolean(created)} onClick={() => void buy(tier)}>{t(mine ? "Paketi uzat" : "Paketi al")}</button>
          : account ? <p className="firm-plans-note">{t(kind === "service" ? "Bu paket hizmet firması hesapları içindir." : "Bu paket müteahhit hesapları içindir.")}</p> : null)}
        {tier === "free" && account === null && <Link className="pricing-plan-cta" href={`/giris?mode=register&role=${kind}&next=${encodeURIComponent(kind === "service" ? "/hizmetler/panel" : "/muteahhitler/panel")}`}>{t("Ücretsiz kayıt ol")}</Link>}
        <div className="pricing-plan-features">{ROWS[kind].map((row) => <span key={row.label}>{cell(row.value(tier))}<span>{t(row.label)}</span></span>)}</div>
      </article>;
    })}</div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {(created || pending) && orders?.bank && <div className="firm-plans-transfer"><h2>{t("Ödeme bilgileri")}</h2><TransferDetails bank={orders.bank} order={created || pending!}/></div>}
    <p className="firm-plans-foot">{t("Fiyatlara KDV dahil değildir. Paket istendiği an kapatılır, iptal cezası yoktur. \"Belgeli\" ve \"Doğrulanmış\" rozetleri her pakette ücretsizdir, yalnızca belgeyle verilir.")}</p>
  </section>;
}
