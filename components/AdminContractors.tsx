"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "./SafeLink";
import { ArrowRight, BadgeCheck, Ban, Check, HardHat, Star, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { apiJson } from "@/lib/api-client";
import { CONTRACTOR_STATUSES, CONTRACTOR_STATUS_LABELS, contractorPath, specialtyName, type ContractorFirm, type ContractorStatus } from "@/lib/contractors";

type Action = "approve" | "reject" | "suspend" | "verify" | "unverify" | "feature" | "unfeature";

function ContractorReview({ firm, onDone }: { firm: ContractorFirm; onDone: () => void }) {
  const { t, locale } = useLocale();
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function act(action: Action) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/contractors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: firm.id, action, note }) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      onDone();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const areas = firm.areas.map((area) => area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`).join(" · ");
  return <article className="admin-card admin-project-review admin-service-review">
    <div className="admin-project-photo">{firm.logo || firm.cover ? <img src={firm.logo || firm.cover!} alt=""/> : <HardHat size={32}/>}</div>
    <div className="admin-project-body">
      <h3>{firm.name} {firm.verified && <span className="admin-badge good"><BadgeCheck size={13}/> {t("Doğrulanmış müteahhit")}</span>} {firm.featured && <span className="admin-badge pending"><Star size={13}/> {t("Öne çıkan")}</span>}</h3>
      <p><strong>{firm.ownerName || "—"}</strong>{firm.ownerEmail ? ` · ${firm.ownerEmail}` : ""} · <span className={`admin-badge ${firm.status === "approved" ? "good" : firm.status === "pending" ? "pending" : "neutral"}`}>{t(CONTRACTOR_STATUS_LABELS[firm.status])}</span></p>
      <p className="admin-project-units">{firm.specialties.map((slug) => t(specialtyName(slug))).join(" · ")}{firm.landDeals ? ` · ${t("Kat karşılığı")}` : ""}</p>
      <p className="admin-project-units">{areas}</p>
      <p className="admin-project-description">{firm.description.slice(0, 400)}{firm.description.length > 400 ? "…" : ""}</p>
      <small>
        <a href={`tel:${firm.phone}`}>{firm.phone}</a>{firm.whatsapp ? ` · WhatsApp ${firm.whatsapp}` : ""}{firm.email ? <> · <a href={`mailto:${firm.email}`}>{firm.email}</a></> : null}
        {firm.website ? <> · <a href={firm.website} target="_blank" rel="noopener noreferrer nofollow">{firm.website}</a></> : null}
        {" · "}{t("{n} tamamlanan proje").replace("{n}", String(firm.projects.length))}{firm.foundedYear ? ` · ${t("Kuruluş yılı")} ${firm.foundedYear}` : ""} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(firm.updatedAt))}
      </small>
      <p className="admin-service-tax">{t("Yetki belgesi no")}: {firm.licenseNumber || t("Girilmedi")} · {t("Vergi bilgileri")}: {firm.taxOffice || firm.taxNumber ? `${firm.taxOffice || "—"} / ${firm.taxNumber || "—"}` : t("Girilmedi")}</p>
      {firm.reviewNote && <p className="admin-service-tax">{t("Yönetici notu")}: {firm.reviewNote}</p>}
      <label>{t("İnceleme notu (reddederken veya askıya alırken zorunlu)")}<textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}/></label>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="admin-project-actions">
        <Link className="admin-secondary" href={contractorPath(firm.id)} target="_blank" rel="noopener noreferrer">{t("Önizle")} <ArrowRight size={14}/></Link>
        {firm.ownerId && <Link className="admin-secondary" href={`/yonetim?view=messages&recipient=${firm.ownerId}`}>{t("Mesaj yaz")}</Link>}
        {firm.status === "pending" && <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act("reject")}><X size={15}/>{t("Reddet")}</button>}
        {firm.status === "approved" && <>
          <button type="button" className="admin-secondary" disabled={busy || (!firm.verified && !firm.licenseNumber)} title={!firm.licenseNumber ? t("Yetki belgesi numarası olmayan firma doğrulanamaz.") : undefined} onClick={() => void act(firm.verified ? "unverify" : "verify")}><BadgeCheck size={15}/>{t(firm.verified ? "Doğrulamayı kaldır" : "Doğrulanmış olarak işaretle")}</button>
          <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act(firm.featured ? "unfeature" : "feature")}><Star size={15}/>{t(firm.featured ? "Öne çıkarmayı kaldır" : "Öne çıkar")}</button>
          <button type="button" className="admin-secondary" disabled={busy} onClick={() => void act("suspend")}><Ban size={15}/>{t("Askıya al")}</button>
        </>}
        {firm.status !== "approved" && <button type="button" className="admin-primary" disabled={busy} onClick={() => void act("approve")}><Check size={15}/>{t(firm.status === "suspended" ? "Yeniden yayınla" : "Onayla ve yayınla")}</button>}
      </div>
    </div>
  </article>;
}

// Admin view "Müteahhitler": review queue and published firms of the contractor directory (lib/contractors.ts).
export function AdminContractors() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<ContractorStatus>("pending");
  const [data, setData] = useState<{ firms: ContractorFirm[]; totals: Record<ContractorStatus, number>; openLandRequests: number } | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/contractors?status=${status}`, { cache: "no-store" });
      const result = await apiJson<{ error?: string; firms: ContractorFirm[]; totals: Record<ContractorStatus, number>; openLandRequests: number }>(response);
      if (!response.ok) throw new Error(result.error || "Müteahhitler yüklenemedi.");
      setData(result); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [status]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return <section className="admin-projects admin-services">
    <div className="admin-section-title"><div><h2>{t("Müteahhitler")}</h2><p>{t("Onaylanan firmalar Müteahhitler bölümünde yayınlanır. Doğrulama rozetini yetki belgesi numarasını Bakanlığın sisteminden kontrol ettikten sonra verin.")}</p></div><Link href="/muteahhitler" className="admin-secondary" target="_blank" rel="noopener noreferrer">{t("Müteahhitler sayfası")} <ArrowRight size={14}/></Link></div>
    <div className="admin-filterbar"><div className="admin-tabs">{CONTRACTOR_STATUSES.map((name) => <button key={name} aria-pressed={status === name} onClick={() => setStatus(name)}>{t(CONTRACTOR_STATUS_LABELS[name])}{data ? ` (${new Intl.NumberFormat(locale).format(data.totals[name] || 0)})` : ""}</button>)}</div></div>
    {data && <div className="admin-notice" role="status">{t("Açık kat karşılığı talebi: {n}").replace("{n}", new Intl.NumberFormat(locale).format(data.openLandRequests))}</div>}
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {!data && !error && <div className="admin-card admin-loading">{t("Yükleniyor...")}</div>}
    {data && (data.firms.length ? data.firms.map((firm) => <ContractorReview key={firm.id} firm={firm} onDone={() => void load()}/>) : <div className="admin-card admin-empty"><HardHat size={28}/><strong>{t("Bu durumda firma yok.")}</strong></div>)}
  </section>;
}
