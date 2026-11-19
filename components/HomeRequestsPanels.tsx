"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, CalendarPlus, CheckCircle2, Eye, Inbox, Mail, MessageCircle, Phone, Search, Send, UserRound } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { HOME_CLOSE_REASONS, HOME_CONTACT, HOME_CONTACT_TIMES, HOME_PAYMENTS, HOME_TIMELINES, HOME_TYPES, type AgentHomeRequest, type HomeRequest, type MyHomeRequest } from "@/lib/home-requests";

// "Benim için bul" in Hesabım (lib/home-requests.ts): the agent's incoming requests (CRM tab) and the
// member's own requests (Aramalarım tab) with their progress, the agents who got in touch and matching listings.
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

export function AgentHomeRequests() {
  const { t } = useLocale();
  const [requests, setRequests] = useState<AgentHomeRequest[] | null>(null), [error, setError] = useState("");
  const load = useCallback(() => fetch("/api/home-requests?agent=1", { cache: "no-store" }).then((response) => apiJson<{ requests?: AgentHomeRequest[]; error?: string }>(response).then((data) => { if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi."); setRequests(data.requests || []); })).catch((cause) => setError((cause as Error).message)), []);
  useEffect(() => { void load(); }, [load]);
  async function mark(id: string, state: "contacted" | "passed") {
    const response = await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "state", id, state }) });
    if (response.ok) void load(); else setError((await apiJson<{ error?: string }>(response)).error || "İşlem tamamlanamadı.");
  }
  return <section id="musteri-talepleri" className="svc-tool-card">
    <div className="svc-tool-head"><Search size={20} aria-hidden="true"/><div><h3>{t("Müşteri talepleri")}</h3><p>{t("\"Benim için bul\" formunu dolduran ve bölgenizde ev arayan üyeler. İletişim bilgilerini sizinle paylaşmayı kabul ettiler.")}</p></div></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {requests === null ? !error && <p>{t("Yükleniyor...")}</p> : !requests.length ? <div className="panel-empty"><Inbox size={26}/><p>{t("Henüz müşteri talebi yok. Talepler, yayındaki ilanlarınızın bulunduğu bölgelerden gelir.")}</p></div>
    : requests.map((request) => <article key={request.id} className="svc-inbox-item">
      <header><strong>{request.name}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <Summary request={request}/>
      <DetailTags request={request} forAgent/>
      {request.note && <p dir="auto">{request.note}</p>}
      {request.status === "open" && <div className="project-editor-actions">
        {request.phone && <a className="outline-button" href={`tel:${request.phone}`}><Phone size={15}/><bdi>{request.phone}</bdi></a>}
        {request.phone && <a className="outline-button" href={whatsappHref(request.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>WhatsApp</a>}
        <a className="outline-button" href={`mailto:${request.email}`}><Mail size={15}/>{request.email}</a>
        {request.state !== "contacted" && <button type="button" className="small-primary" onClick={() => void mark(request.id, "contacted")}>{t("İletişime geçtim")}</button>}
        {request.state !== "passed" && request.state !== "contacted" && <button type="button" className="outline-button" onClick={() => void mark(request.id, "passed")}>{t("Geç")}</button>}
      </div>}
      {request.state === "contacted" && <p className="service-account-meta">{t("İletişime geçtiniz.")}</p>}
    </article>)}
  </section>;
}

/** Sent → seen → answered, as three steps with counts. */
function Progress({ request }: { request: MyHomeRequest }) {
  const { t } = useLocale();
  const steps = [
    { icon: Send, label: t("{n} danışmana iletildi").replace("{n}", String(request.agents)), on: request.agents > 0 },
    { icon: Eye, label: t("{n} danışman gördü").replace("{n}", String(request.seen)), on: request.seen > 0 },
    { icon: CheckCircle2, label: t("{n} danışman size döndü").replace("{n}", String(request.contacted)), on: request.contacted > 0 },
  ];
  return <ol className="request-progress">{steps.map(({ icon: Icon, label, on }) => <li key={label} className={on ? "on" : ""}><Icon size={16} aria-hidden="true"/>{label}</li>)}</ol>;
}

export function MyHomeRequests() {
  const { t, locale } = useLocale();
  const [requests, setRequests] = useState<MyHomeRequest[] | null>(null);
  const [closing, setClosing] = useState<string | null>(null), [error, setError] = useState("");
  const load = useCallback(() => fetch("/api/home-requests", { cache: "no-store" }).then((response) => apiJson<{ requests?: MyHomeRequest[] }>(response)).then((data) => setRequests(data.requests || [])).catch(() => setRequests([])), []);
  useEffect(() => { void load(); }, [load]);
  async function act(payload: Record<string, string>) {
    setError("");
    const response = await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) setError((await apiJson<{ error?: string }>(response)).error || "İşlem tamamlanamadı.");
    setClosing(null); void load();
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  if (!requests) return null;
  return <section id="benim-icin-bul" className="svc-tool-card">
    <div className="svc-tool-head"><Search size={20} aria-hidden="true"/><div><h3>{t("Benim için bul taleplerim")}</h3><p>{t("Danışmanlara gönderdiğiniz ev arama talepleri.")} <Link href="/benim-icin-bul">{t("Yeni talep")}</Link></p></div></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!requests.length ? <div className="panel-empty"><Search size={26}/><p>{t("Aradığınız evi anlatın; bölgenin onaylı danışmanları size uygun seçeneklerle dönsün.")}</p><Link className="primary-button" href="/benim-icin-bul">{t("Benim için bul")}</Link></div>
    : requests.map((request) => <article key={request.id} className="svc-inbox-item request-item">
      <header><strong>{t(request.intent === "buy" ? "Satılık" : "Kiralık")} · {request.city}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <Summary request={request}/>
      <DetailTags request={request}/>
      <Progress request={request}/>
      {request.contactedAgents.length > 0 && <div className="request-agents"><span>{t("Size dönen danışmanlar")}</span>
        <ul>{request.contactedAgents.map((agent) => <li key={agent.id}><Link href={`/profil/${agent.id}`}><UserRound size={15} aria-hidden="true"/><strong>{agent.name}</strong>{agent.company && <small>{agent.company}</small>}</Link></li>)}</ul></div>}
      <p className="service-account-meta">{request.status === "open" ? t("{date} tarihine kadar açık").replace("{date}", date(request.expiresAt)) : request.status === "closed" && request.closeReason ? `${t("Kapatma nedeni")}: ${t(HOME_CLOSE_REASONS[request.closeReason as keyof typeof HOME_CLOSE_REASONS] || request.closeReason)}` : t("Süresi doldu")}</p>
      <div className="project-editor-actions">
        <Link className="outline-button" href={`/ilanlar?${request.search}`}><Search size={15} aria-hidden="true"/>{t("Uyan ilanları gör")}<ArrowRight size={15} aria-hidden="true"/></Link>
        {request.status === "open" && closing !== request.id && <button type="button" className="outline-button" onClick={() => setClosing(request.id)}>{t("Talebi kapat")}</button>}
        <button type="button" className="outline-button" onClick={() => void act({ action: "extend", id: request.id })}><CalendarPlus size={15} aria-hidden="true"/>{t(request.status === "open" ? "30 gün uzat" : "Yeniden aç")}</button>
      </div>
      {closing === request.id && <div className="request-close" role="group" aria-label={t("Neden kapatıyorsunuz?")}><span>{t("Neden kapatıyorsunuz?")}</span>
        {Object.entries(HOME_CLOSE_REASONS).map(([value, label]) => <button key={value} type="button" className="outline-button" onClick={() => void act({ action: "close", id: request.id, reason: value })}>{t(label)}</button>)}
        <button type="button" className="text-button" onClick={() => setClosing(null)}>{t("Vazgeç")}</button></div>}
    </article>)}
  </section>;
}
