"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Inbox, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import type { AgentHomeRequest, HomeRequest } from "@/lib/home-requests";

// "Benim için bul" in Hesabım (lib/home-requests.ts): the agent's incoming requests (CRM tab) and the
// member's own requests (Aramalarım tab).
const STATUS: Record<string, string> = { open: "Açık", closed: "Kapatıldı", expired: "Süresi doldu" };
const CATEGORY: Record<string, string> = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" };

function Summary({ request }: { request: HomeRequest }) {
  const { t, locale } = useLocale();
  const budget = request.budgetMin || request.budgetMax;
  return <p className="service-account-meta">
    <strong>{t(request.intent === "buy" ? "Satın almak istiyor" : "Kiralamak istiyor")}</strong> · {request.district ? `${request.district}, ` : ""}{request.city} · {t(CATEGORY[request.category] || request.category)}{request.rooms && <> · {t(request.rooms)}</>}
    {budget ? <> · {request.budgetMin ? <Money value={request.budgetMin} currency="TRY"/> : "…"} – {request.budgetMax ? <Money value={request.budgetMax} currency="TRY"/> : "…"}</> : null}
    {" · "}{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(request.createdAt))}
  </p>;
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

export function MyHomeRequests() {
  const { t } = useLocale();
  const [requests, setRequests] = useState<(HomeRequest & { agents: number })[] | null>(null);
  const load = useCallback(() => fetch("/api/home-requests", { cache: "no-store" }).then((response) => apiJson<{ requests?: (HomeRequest & { agents: number })[] }>(response)).then((data) => setRequests(data.requests || [])).catch(() => setRequests([])), []);
  useEffect(() => { void load(); }, [load]);
  async function close(id: string) { await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", id }) }); void load(); }
  if (!requests?.length) return null;
  return <section className="svc-tool-card">
    <div className="svc-tool-head"><Search size={20} aria-hidden="true"/><div><h3>{t("Benim için bul taleplerim")}</h3><p>{t("Danışmanlara gönderdiğiniz ev arama talepleri.")} <Link href="/benim-icin-bul">{t("Yeni talep")}</Link></p></div></div>
    {requests.map((request) => <article key={request.id} className="svc-inbox-item">
      <header><strong>{t("{n} danışmana iletildi").replace("{n}", String(request.agents))}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <Summary request={request}/>
      {request.status === "open" && <div className="project-editor-actions"><button type="button" className="outline-button" onClick={() => void close(request.id)}>{t("Talebi kapat")}</button></div>}
    </article>)}
  </section>;
}
