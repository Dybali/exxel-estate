"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "./SafeLink";
import { ArrowRight, BadgeCheck, Ban, Check, Star, Store, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { apiJson } from "@/lib/api-client";
import { serviceCategory } from "@/lib/service-categories";
import { firmPath, SERVICE_STATUSES, SERVICE_STATUS_LABELS, type ServiceFirm, type ServiceStatus } from "@/lib/services";

type Action = "approve" | "reject" | "suspend" | "verify" | "unverify" | "feature" | "unfeature";

function FirmReview({ firm, onDone }: { firm: ServiceFirm; onDone: () => void }) {
  const { t, locale } = useLocale();
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function act(action: Action) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: firm.id, action, note }) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      onDone();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const areas = firm.areas.map((area) => area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`).join(" · ");
  return <article className="admin-card admin-project-review admin-service-review">
    <div className="admin-project-photo">{firm.logo || firm.cover ? <img src={firm.logo || firm.cover!} alt=""/> : <Store size={32}/>}</div>
    <div className="admin-project-body">
      <h3>{firm.name} {firm.verified && <span className="admin-badge good"><BadgeCheck size={13}/> {t("Doğrulanmış firma")}</span>} {firm.featured && <span className="admin-badge pending"><Star size={13}/> {t("Öne çıkan")}</span>}</h3>
      <p><strong>{firm.ownerName || "—"}</strong>{firm.ownerEmail ? ` · ${firm.ownerEmail}` : ""} · <span className={`admin-badge ${firm.status === "approved" ? "good" : firm.status === "pending" ? "pending" : "neutral"}`}>{t(SERVICE_STATUS_LABELS[firm.status])}</span></p>
      <p className="admin-project-units">{firm.categories.map((slug) => t(serviceCategory(slug)?.name || slug)).join(" · ")}</p>
      <p className="admin-project-units">{areas}</p>
      <p className="admin-project-description">{firm.description.slice(0, 400)}{firm.description.length > 400 ? "…" : ""}</p>
      <small>
        <a href={`tel:${firm.phone}`}>{firm.phone}</a>{firm.whatsapp ? ` · WhatsApp ${firm.whatsapp}` : ""}{firm.email ? <> · <a href={`mailto:${firm.email}`}>{firm.email}</a></> : null}
        {firm.website ? <> · <a href={firm.website} target="_blank" rel="noopener noreferrer nofollow">{firm.website}</a></> : null}
        {" · "}{t("{n} fotoğraf").replace("{n}", String(firm.photos.length))} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(firm.updatedAt))}
      </small>
      <p className="admin-service-tax">{t("Vergi bilgileri")}: {firm.taxOffice || firm.taxNumber ? `${firm.taxOffice || "—"} / ${firm.taxNumber || "—"}` : t("Girilmedi")}</p>
      {firm.reviewNote && <p className="admin-service-tax">{t("Yönetici notu")}: {firm.reviewNote}</p>}
      <label>{t("İnceleme notu (reddederken veya askıya alırken zorunlu)")}<textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}/></label>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="admin-project-actions">
        <Link className="admin-secondary" href={firmPath(firm.id)} target="_blank" rel="noopener noreferrer">{t("Önizle")} <ArrowRight size={14}/></Link>
        {firm.ownerId && <Link className="admin-secondary" href={`/yonetim?view=messages&recipient=${firm.ownerId}`}>{t("Mesaj yaz")}</Link>}
        {firm.status === "pending" && <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act("reject")}><X size={15}/>{t("Reddet")}</button>}
        {firm.status === "approved" && <>
          <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act(firm.verified ? "unverify" : "verify")}><BadgeCheck size={15}/>{t(firm.verified ? "Doğrulamayı kaldır" : "Doğrulanmış olarak işaretle")}</button>
          <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act(firm.featured ? "unfeature" : "feature")}><Star size={15}/>{t(firm.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar")}</button>
          <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act("suspend")}><Ban size={15}/>{t("Askıya al")}</button>
        </>}
        {firm.status !== "approved" && <button type="button" className="admin-primary" disabled={busy} onClick={() => void act("approve")}><Check size={15}/>{t(firm.status === "suspended" ? "Yeniden yayınla" : "Onayla ve yayınla")}</button>}
      </div>
    </div>
  </article>;
}

// Admin view "Hizmet firmaları": review queue and published firms of the service directory (lib/services.ts).
export function AdminServices() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<ServiceStatus>("pending");
  const [data, setData] = useState<{ firms: ServiceFirm[]; totals: Record<ServiceStatus, number> } | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/services?status=${status}`, { cache: "no-store" });
      const result = await apiJson<{ error?: string; firms: ServiceFirm[]; totals: Record<ServiceStatus, number> }>(response);
      if (!response.ok) throw new Error(result.error || "Hizmet firmaları yüklenemedi.");
      setData(result); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [status]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return <section className="admin-projects admin-services">
    <div className="admin-section-title"><div><h2>{t("Hizmet firmaları")}</h2><p>{t("Onaylanan firmalar Hizmetler bölümünde yayınlanır. Reddetme ve askıya alma notları firmaya gösterilir.")}</p></div><Link href="/hizmetler" className="admin-secondary" target="_blank" rel="noopener noreferrer">{t("Hizmetler sayfası")} <ArrowRight size={14}/></Link></div>
    <div className="admin-filterbar"><div className="admin-tabs">{SERVICE_STATUSES.map((name) => <button key={name} aria-pressed={status === name} onClick={() => setStatus(name)}>{t(SERVICE_STATUS_LABELS[name])}{data ? ` (${new Intl.NumberFormat(locale).format(data.totals[name] || 0)})` : ""}</button>)}</div></div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {!data && !error && <div className="admin-card admin-loading">{t("Yükleniyor...")}</div>}
    {data && (data.firms.length ? data.firms.map((firm) => <FirmReview key={firm.id} firm={firm} onDone={() => void load()}/>) : <div className="admin-card admin-empty"><Store size={28}/><strong>{t("Bu durumda firma yok.")}</strong></div>)}
  </section>;
}
