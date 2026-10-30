"use client";
import {useCallback, useEffect, useState} from "react";
import Link from "./SafeLink";
import {ArrowRight, Building2, Check, X} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {formatPrice} from "@/lib/listings";
import {PROJECT_STATUS_LABELS, type Project} from "@/lib/projects";

function PendingProject({project, onDone}: {project: Project; onDone: () => void}) {
  const {t, locale} = useLocale();
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function review(decision: "approved" | "rejected") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/projects", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: project.id, decision, note})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      onDone();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <article className="admin-card admin-project-review">
    <div className="admin-project-photo">{project.images[0] ? <img src={project.images[0]} alt=""/> : <Building2 size={32}/>}</div>
    <div className="admin-project-body">
      <h3>{project.name}</h3>
      <p><strong>{project.ownerName}</strong> · {[project.neighborhood, project.district, project.city].filter(Boolean).join(", ")} · {t(PROJECT_STATUS_LABELS[project.status])}{project.deliveryDate ? ` · ${project.deliveryDate}` : ""}</p>
      <p className="admin-project-units">{project.unitTypes.map((unit) => `${unit.rooms} · ${unit.minArea}–${unit.maxArea} m² · ${formatPrice(unit.priceFrom, unit.currency, locale)}`).join(" | ")}</p>
      <p className="admin-project-description">{project.description.slice(0, 400)}{project.description.length > 400 ? "…" : ""}</p>
      <small>{t("{n} fotoğraf").replace("{n}", String(project.images.length))} · {new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(project.updatedAt))}{project.website ? <> · <a href={project.website} target="_blank" rel="noopener noreferrer nofollow">{project.website}</a></> : null}</small>
      <label>{t("İnceleme notu (reddederken zorunlu)")}<textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}/></label>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="admin-project-actions">
        <Link className="admin-secondary" href={`/projeler/${project.id}`} target="_blank" rel="noopener noreferrer">{t("Önizle")} <ArrowRight size={14}/></Link>
        <button type="button" className="admin-secondary" disabled={busy} onClick={() => void review("rejected")}><X size={15}/>{t("Reddet")}</button>
        <button type="button" className="admin-primary" disabled={busy} onClick={() => void review("approved")}><Check size={15}/>{t("Onayla ve yayınla")}</button>
      </div>
    </div>
  </article>;
}

// Admin view "Projeler": pending housing projects waiting for approval.
export function AdminProjects() {
  const {t} = useLocale();
  const [projects, setProjects] = useState<Project[] | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/projects", {cache: "no-store"});
      const data = await apiJson<{error?: string; projects: Project[]}>(response);
      if (!response.ok) throw new Error(data.error || "Projeler yüklenemedi.");
      setProjects(data.projects); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="admin-projects">
    <div className="admin-section-title"><div><h2>{t("Onay bekleyen projeler")}</h2><p>{t("Onaylanan projeler Projeler sayfasında yayınlanır. Reddedilen projelerde not yayıncıya gösterilir.")}</p></div><Link href="/projeler" className="admin-secondary" target="_blank" rel="noopener noreferrer">{t("Yayındaki projeler")} <ArrowRight size={14}/></Link></div>
    {error && <div className="admin-notice error" role="alert">{t(error)}</div>}
    {!projects && !error && <div className="admin-card admin-loading">{t("Projeler yükleniyor...")}</div>}
    {projects && (projects.length ? projects.map((project) => <PendingProject key={project.id} project={project} onDone={() => void load()}/>) : <div className="admin-card admin-empty"><Building2 size={28}/><strong>{t("Onay bekleyen proje yok.")}</strong></div>)}
  </section>;
}
