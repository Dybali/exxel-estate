"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, CalendarPlus, CheckCircle2, Phone, Radio, Search, Send, UserRound, Zap } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { HOME_CLOSE_REASONS, HOME_CONTACT, HOME_CONTACT_TIMES, HOME_PAYMENTS, HOME_TIMELINES, HOME_TYPES, type HomeRequest, type MyHomeRequest } from "@/lib/home-requests";
import type { MemberOffer } from "@/lib/lead-board";
export { LeadBoard as AgentHomeRequests } from "./LeadBoard";
import { FeatureTip } from "./FeatureTip";

// "Benim için bul" in Hesabım (lib/home-requests.ts): the member's own requests (Aramalarım tab) with the offers
// and phone reveals of the agents who reached them on the open board (components/LeadBoard.tsx, CRM tab).
const STATUS: Record<string, string> = { open: "Açık", closed: "Kapatıldı", expired: "Süresi doldu" };
const CATEGORY: Record<string, string> = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" };

function Summary({ request }: { request: HomeRequest }) {
  const { t, locale } = useLocale();
  const budget = request.budgetMin || request.budgetMax;
  const d = request.details;
  const districts = d?.districts.length ? d.districts.join(", ") : request.district;
  const types = (d?.types || []).map((value) => t(HOME_TYPES[request.category]?.find((item) => item.value === value)?.label || value)).join(", ");
  return <p className="service-account-meta">
    <strong>{t(request.intent === "buy" ? "Satın almak istiyor" : "Kiralamak istiyor")}</strong> · {districts ? `${districts}, ` : ""}{request.city} · {types || t(CATEGORY[request.category] || request.category)}{request.rooms && <> · {request.rooms.split(", ").map((item) => t(item)).join(", ")}</>}
    {d?.minArea ? <> · {t("en az")} {new Intl.NumberFormat(locale).format(d.minArea)} m²</> : null}
    {budget ? <> · {request.budgetMin ? <Money value={request.budgetMin} currency="TRY"/> : "…"} – {request.budgetMax ? <Money value={request.budgetMax} currency="TRY"/> : "…"}</> : null}
    {" · "}{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(request.createdAt))}
  </p>;
}

/** Timing, payment, buyer profile, must-haves and contact preference as small tags. */
function DetailTags({ request, forAgent = false }: { request: HomeRequest; forAgent?: boolean }) {
  const { t } = useLocale();
  const d = request.details;
  if (!d) return null;
  const tags = [
    d.timeline ? t(HOME_TIMELINES[d.timeline]) : "",
    d.payment ? t(HOME_PAYMENTS[d.payment]) : "",
    d.foreign ? t(d.citizenship ? "Yabancı alıcı · vatandaşlık amaçlı" : "Yabancı alıcı") : "",
    ...d.features.map((item) => t(item)),
    forAgent ? `${t("İletişim")}: ${t(HOME_CONTACT[d.contact])}${d.contact !== "email" && d.contactTime !== "any" ? ` · ${t(HOME_CONTACT_TIMES[d.contactTime])}` : ""}` : "",
  ].filter(Boolean);
  return tags.length ? <ul className="request-tags">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null;
}

type Reveal = { agentId: string; agentName: string; company: string; createdAt: string };
type MemberRequest = MyHomeRequest & { offers: MemberOffer[]; reveals: Reveal[] };
const PER_REQUEST = 4;

/** On the board → reached by n of 4 agents → offers. */
function Progress({ request }: { request: MemberRequest }) {
  const { t } = useLocale();
  const steps = [
    { icon: Radio, label: t(request.status === "open" ? "Talep akışında yayında" : "Talep akışından kalktı"), on: request.status === "open" },
    { icon: Phone, label: t("{n}/{max} danışman ulaştı").replace("{n}", String(request.reached)).replace("{max}", String(PER_REQUEST)), on: request.reached > 0 },
    { icon: Send, label: t("{n} teklif").replace("{n}", String(request.offers.length)), on: request.offers.length > 0 },
  ];
  return <ol className="request-progress">{steps.map(({ icon: Icon, label, on }) => <li key={label} className={on ? "on" : ""}><Icon size={16} aria-hidden="true"/>{label}</li>)}</ol>;
}

export function MyHomeRequests() {
  const { t, locale } = useLocale();
  const [requests, setRequests] = useState<MemberRequest[] | null>(null);
  const [closing, setClosing] = useState<string | null>(null), [foundWith, setFoundWith] = useState(""), [error, setError] = useState("");
  const load = useCallback(() => fetch("/api/home-requests", { cache: "no-store" }).then((response) => apiJson<{ requests?: MemberRequest[] }>(response)).then((data) => setRequests(data.requests || [])).catch(() => setRequests([])), []);
  useEffect(() => { void load(); }, [load]);
  async function act(payload: Record<string, string>) {
    setError("");
    const response = await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) setError((await apiJson<{ error?: string }>(response)).error || "İşlem tamamlanamadı.");
    setClosing(null); setFoundWith(""); void load();
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  if (!requests) return null;
  return <section id="benim-icin-bul" className="svc-tool-card">
    <div className="svc-tool-head"><Search size={20} aria-hidden="true"/><div><h3>{t("Benim için bul taleplerim")}</h3><p>{t("Talepleriniz danışmanların gördüğü talep akışında yayınlanır; size en fazla 4 danışman ulaşabilir.")} <Link href="/benim-icin-bul">{t("Yeni talep")}</Link></p></div></div>
    {requests.length > 0 && <FeatureTip id="benim-icin-bul-takip" title="Teklifler buraya gelir" text="Danışmanlar talebinize teklif gönderdiğinde burada mesajlarını ve önerdikleri ilanları görürsünüz; size e-posta da gelir. Evi bulunca talebi kapatın, bulamazsanız 30 gün uzatın."/>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!requests.length ? <div className="panel-empty"><Search size={26}/><p>{t("Aradığınız evi anlatın; bölgenin onaylı danışmanları size uygun seçeneklerle dönsün.")}</p><Link className="primary-button" href="/benim-icin-bul">{t("Benim için bul")}</Link></div>
    : requests.map((request) => {
      const agents = [...new Map([...request.offers, ...request.reveals].map((item) => [item.agentId, item.agentName])).entries()];
      return <article key={request.id} className="svc-inbox-item request-item">
      <header><strong>{t(request.intent === "buy" ? "Satılık" : "Kiralık")} · {request.city}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <Summary request={request}/>
      <DetailTags request={request}/>
      <Progress request={request}/>
      {request.offers.length > 0 && <div className="request-offers"><span>{t("Gelen teklifler")}</span>
        {request.offers.map((offer) => <div key={offer.agentId + offer.createdAt} className="request-offer">
          <header><Link href={`/profil/${offer.agentId}`}><UserRound size={15} aria-hidden="true"/><strong>{offer.agentName}</strong>{offer.company && <small>{offer.company}</small>}</Link>{offer.fast && <span className="lead-fast"><Zap size={12} aria-hidden="true"/>{t("Hızlı yanıt")}</span>}<time>{date(offer.createdAt)}</time></header>
          <p dir="auto">{offer.message}</p>
          {offer.listings.length > 0 && <ul>{offer.listings.map((listing) => <li key={listing.id}><Link href={`/ilan/${listing.id}`}>{listing.title}<ArrowRight size={14} aria-hidden="true"/></Link></li>)}</ul>}
        </div>)}</div>}
      {request.reveals.length > 0 && <p className="service-account-meta"><Phone size={14} aria-hidden="true"/> {t("Telefon numaranızı görüntüleyenler")}: {request.reveals.map((item) => item.agentName).join(", ")}</p>}
      <p className="service-account-meta">{request.status === "open" ? t("{date} tarihine kadar açık").replace("{date}", date(request.expiresAt)) : request.status === "closed" && request.closeReason ? `${t("Kapatma nedeni")}: ${t(HOME_CLOSE_REASONS[request.closeReason as keyof typeof HOME_CLOSE_REASONS] || request.closeReason)}` : t("Süresi doldu")}</p>
      <div className="project-editor-actions">
        <Link className="outline-button" href={`/ilanlar?${request.search}`}><Search size={15} aria-hidden="true"/>{t("Uyan ilanları gör")}<ArrowRight size={15} aria-hidden="true"/></Link>
        {request.status === "open" && closing !== request.id && <button type="button" className="outline-button" onClick={() => setClosing(request.id)}>{t("Talebi kapat")}</button>}
        <button type="button" className="outline-button" onClick={() => void act({ action: "extend", id: request.id })}><CalendarPlus size={15} aria-hidden="true"/>{t(request.status === "open" ? "30 gün uzat" : "Yeniden aç")}</button>
      </div>
      {closing === request.id && <div className="request-close" role="group" aria-label={t("Neden kapatıyorsunuz?")}><span>{t("Neden kapatıyorsunuz?")}</span>
        {agents.length > 0 && <label className="request-found-with">{t("Hangi danışmanla buldunuz?")}<select value={foundWith} onChange={(event) => setFoundWith(event.target.value)}><option value="">{t("Seçin")}</option>{agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        {Object.entries(HOME_CLOSE_REASONS).map(([value, label]) => <button key={value} type="button" className="outline-button" onClick={() => void act({ action: "close", id: request.id, reason: value, foundWith: value === "found_here" ? foundWith : "" })}>{value === "found_here" && <CheckCircle2 size={15} aria-hidden="true"/>}{t(label)}</button>)}
        <button type="button" className="text-button" onClick={() => setClosing(null)}>{t("Vazgeç")}</button></div>}
    </article>; })}
  </section>;
}
