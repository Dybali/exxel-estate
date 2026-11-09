"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, ClipboardList, ExternalLink, FileCheck2, Mail, MessageCircle, Phone, Plus, X } from "lucide-react";
import Link from "@/components/SafeLink";
import { useTry } from "@/components/ServiceFirmTools";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { serviceCategory } from "@/lib/service-categories";
import { QUOTE_STATUS_LABELS, QUOTE_TIMINGS, type QuoteRequestView } from "@/lib/service-extras";
import { firmPath, quoteHref, SERVICE_QUOTE_PATH } from "@/lib/services";

// Hesabım tab "Teklif taleplerim": the member's quote requests with the offers side by side (cheapest first).
export function ServiceQuotesPanel() {
  const { t, locale } = useLocale(), money = useTry();
  const [requests, setRequests] = useState<QuoteRequestView[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/services/quotes", { cache: "no-store" });
      const data = await apiJson<{ error?: string; requests: QuoteRequestView[] }>(response);
      if (!response.ok) throw new Error(data.error || "Teklif talepleri yüklenemedi.");
      setRequests(data.requests); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(body: Record<string, unknown>, confirmText: string) {
    if (!window.confirm(t(confirmText))) return;
    setBusy(String(body.id || body.offerId));
    try {
      const response = await fetch("/api/services/quotes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  return <section className="svc-quotes-panel">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("HİZMETLER")}</span><h2>{t("Teklif taleplerim")}</h2></div>
      <Link className="small-primary" href={SERVICE_QUOTE_PATH}>{t("Yeni teklif iste")}<Plus size={17} aria-hidden="true"/></Link></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!requests && !error && <p>{t("Yükleniyor...")}</p>}
    {requests && !requests.length && <div className="panel-empty"><ClipboardList size={28} aria-hidden="true"/><h3>{t("Henüz teklif talebiniz yok")}</h3>
      <p>{t("Boya, tadilat, nakliyat, temizlik veya tapu işlemi: işinizi bir kez anlatın, bölgenizdeki onaylı firmalardan fiyat teklifi alın.")}</p>
      <Link href={SERVICE_QUOTE_PATH}>{t("Ücretsiz teklif alın")}<ExternalLink size={15} aria-hidden="true"/></Link></div>}
    {requests?.map((request) => {
      const category = serviceCategory(request.category), place = request.district ? `${request.district}, ${request.city}` : request.city;
      const open = request.status === "open";
      return <article key={request.id} className={`svc-quote-card status-${request.status}`}>
        <header>
          <div><h3>{category ? t(category.name) : request.category} · {place}</h3>
            <p className="svc-inbox-meta">{date(request.createdAt)} · {t(QUOTE_TIMINGS[request.timing])} · {t("{n} firmaya gönderildi, {m} firma gördü").replace("{n}", String(request.recipients)).replace("{m}", String(request.seen))}</p></div>
          <span className={`service-status status-${open ? "approved" : request.status === "accepted" ? "approved" : "pending"}`}>{t(QUOTE_STATUS_LABELS[request.status])}</span>
        </header>
        <details><summary>{t("Talebiniz")}</summary><p className="svc-inbox-text" dir="auto">{request.description}</p></details>
        {request.offers.length === 0 ? <p className="svc-empty">{t(open ? "Henüz teklif gelmedi. Firmalar genellikle 24 saat içinde yanıt verir; teklif gelince e-posta ile haber veririz." : "Bu talebe teklif gelmedi.")}</p>
          : <div className="svc-offer-compare" role="list" aria-label={t("Gelen teklifler")}>{request.offers.map((offer, index) => <div role="listitem" key={offer.id} className={`svc-offer-card state-${offer.state}${index === 0 && request.offers.length > 1 ? " cheapest" : ""}`}>
            {index === 0 && request.offers.length > 1 && <span className="svc-offer-flag">{t("En uygun fiyat")}</span>}
            {offer.state === "accepted" && <span className="svc-offer-flag accepted"><Check size={13} aria-hidden="true"/>{t("Seçtiğiniz teklif")}</span>}
            <div className="svc-offer-firm">
              <span className="service-firm-logo">{offer.firmLogo ? <img src={offer.firmLogo} alt=""/> : <b>{offer.firmName.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
              <div><Link href={firmPath(offer.firmId)} target="_blank" rel="noopener noreferrer"><strong>{offer.firmName}</strong></Link>
                <span className="svc-offer-badges">{offer.verified && <span><BadgeCheck size={13} aria-hidden="true"/>{t("Doğrulanmış")}</span>}{offer.documented && <span><FileCheck2 size={13} aria-hidden="true"/>{t("Belgeli")}</span>}</span></div>
            </div>
            <p className="svc-offer-price">{money(offer.priceMin)}{offer.priceMax ? <> – {money(offer.priceMax)}</> : null}</p>
            <p className="svc-offer-message" dir="auto">{offer.message}</p>
            <small className="svc-inbox-meta">{date(offer.createdAt)}</small>
            <div className="svc-offer-contact">
              {offer.firmPhone && <a href={`tel:${offer.firmPhone}`} aria-label={t("Ara")}><Phone size={15} aria-hidden="true"/></a>}
              {offer.firmWhatsapp && <a href={whatsappHref(offer.firmWhatsapp)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><MessageCircle size={15} aria-hidden="true"/></a>}
              {offer.firmEmail && <a href={`mailto:${offer.firmEmail}`} aria-label={t("E-posta gönder")}><Mail size={15} aria-hidden="true"/></a>}
              {open && offer.state === "sent" && <button type="button" className="small-primary" disabled={Boolean(busy)} onClick={() => void act({ action: "accept", offerId: offer.id }, "Bu teklifi kabul etmek istiyor musunuz? Firma ile iletişim bilgileriniz paylaşılır ve talep kapanır.")}><Check size={15} aria-hidden="true"/>{t("Teklifi kabul et")}</button>}
            </div>
          </div>)}</div>}
        <div className="project-editor-actions">
          {open && <button type="button" className="outline-button" disabled={Boolean(busy)} onClick={() => void act({ action: "close", id: request.id }, "Talep kapatılsın mı? Firmalar artık teklif gönderemez.")}><X size={15} aria-hidden="true"/>{t("Talebi kapat")}</button>}
          {!open && <Link className="outline-button" href={quoteHref({ category: request.category, city: request.city, district: request.district })}>{t("Benzer talep oluştur")}</Link>}
        </div>
      </article>;
    })}
    <p className="project-editor-note">{t("estatemarket24 firmalar ile sizin aranızdaki anlaşmanın tarafı değildir. Fiyat ve iş koşullarını yazılı olarak netleştirin.")}</p>
  </section>;
}
