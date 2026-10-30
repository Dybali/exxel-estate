"use client";
import {useEffect, useState} from "react";
import Link from "@/components/SafeLink";
import {ArrowLeft, Building2, CalendarDays, CheckCircle2, ExternalLink, Home, MapPin} from "lucide-react";
import {ListingGallery} from "./ListingGallery";
import {VerifiedBadge} from "./VerifiedBadge";
import {deliveryLabel, ProjectPriceFrom, ProjectStatusBadge} from "./ProjectCard";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {formatPrice} from "@/lib/listings";
import {PROJECT_MODERATION_LABELS, type Project} from "@/lib/projects";

function ReservationForm({project}: {project: Project}) {
  const {t} = useLocale();
  const [form, setForm] = useState({unitType: project.unitTypes[0]?.rooms || "", name: "", phone: "", email: "", message: "", consent: false});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  const set = (key: "unitType" | "name" | "phone" | "email" | "message") => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((old) => ({...old, [key]: event.target.value}));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/reservations`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(form)});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "Talebiniz gönderilemedi.");
      setSent(true);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  if (sent) return <div className="project-reservation-success" role="status"><CheckCircle2 size={30}/><h3>{t("Talebiniz alındı")}</h3><p>{t("Proje yetkilisi sizinle telefon veya e-posta ile iletişime geçecek. Yer ayırtma talebi bir ödeme veya satış sözleşmesi değildir.")}</p><button type="button" className="outline-button" onClick={() => { setSent(false); setForm((old) => ({...old, message: ""})); }}>{t("Yeni talep gönder")}</button></div>;
  const disabled = project.moderation !== "approved";
  return <form className="project-reservation-form" onSubmit={submit}>
    <h2>{t("Yer ayırtma talebi")}</h2>
    <p>{t("Ücretsizdir; ödeme alınmaz. Talebiniz yalnızca proje yetkilisine iletilir.")}</p>
    <label>{t("Konut tipi")}<select required value={form.unitType} onChange={set("unitType")}>{project.unitTypes.map((unit) => <option key={unit.rooms} value={unit.rooms}>{unit.rooms === "1+0" ? t("Stüdyo") : unit.rooms} · {unit.minArea === unit.maxArea ? unit.minArea : `${unit.minArea}–${unit.maxArea}`} m²</option>)}</select></label>
    <label>{t("Ad Soyad")}<input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={set("name")}/></label>
    <label>{t("Telefon")}<input required type="tel" maxLength={25} autoComplete="tel" placeholder="+90 5xx xxx xx xx" value={form.phone} onChange={set("phone")}/></label>
    <label>{t("E-posta")}<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={set("email")}/></label>
    <label>{t("Mesajınız (isteğe bağlı)")}<textarea rows={3} maxLength={1000} value={form.message} onChange={set("message")}/></label>
    <label className="project-consent"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm((old) => ({...old, consent: event.target.checked}))}/><span>{t("Bilgilerimin bu talep için proje yetkilisiyle paylaşılmasını kabul ediyorum.")} <Link href="/gizlilik-politikasi" target="_blank" rel="noopener noreferrer">{t("Gizlilik politikası")}</Link></span></label>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <button type="submit" className="small-primary" disabled={busy || disabled}>{t(busy ? "Gönderiliyor..." : "Talep gönder")}</button>
  </form>;
}

export function ProjectDetail({id}: {id: string}) {
  const {t, locale} = useLocale();
  const [project, setProject] = useState<Project | null>(null), [missing, setMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${encodeURIComponent(id)}`, {cache: "no-store", signal: controller.signal})
      .then(async (response) => { const data = await apiJson<{project?: Project}>(response); if (!response.ok || !data.project) throw new Error(); setProject(data.project); })
      .catch(() => { if (!controller.signal.aborted) setMissing(true); });
    return () => controller.abort();
  }, [id]);
  if (missing) return <main className="container section project-detail-state"><Building2 size={32}/><h1>{t("Proje bulunamadı.")}</h1><Link href="/projeler" className="outline-button">{t("Tüm projeler")}</Link></main>;
  if (!project) return <main className="container section project-detail-state">{t("Proje yükleniyor...")}</main>;
  const place = [project.neighborhood, project.district, project.city].filter(Boolean).join(", ");
  return <main className="project-detail"><div className="container">
    <Link href="/projeler" className="project-back"><ArrowLeft size={16}/>{t("Tüm projeler")}</Link>
    {project.moderation !== "approved" && <div className="project-moderation-note" role="status"><strong>{t(PROJECT_MODERATION_LABELS[project.moderation])}</strong> · {t("Bu proje henüz yayında değil; yalnızca siz ve yöneticiler görebilir.")}{project.reviewNote ? <p>{project.reviewNote}</p> : null}</div>}
    <header className="project-detail-head">
      <div><ProjectStatusBadge status={project.status}/><h1>{project.name}</h1><p><MapPin size={16}/>{place}</p></div>
      <ProjectPriceFrom project={project}/>
    </header>
    <ListingGallery images={project.images} title={project.name}/>
    <div className="project-detail-layout">
      <div className="project-detail-main">
        <section className="project-facts">
          <div><span>{t("Proje durumu")}</span><strong>{t(project.status === "completed" ? "Tamamlandı" : "Devam ediyor")}</strong></div>
          {project.deliveryDate && <div><span><CalendarDays size={14}/> {t("Teslim tarihi")}</span><strong>{deliveryLabel(project.deliveryDate, locale)}</strong></div>}
          {project.totalUnits && <div><span><Home size={14}/> {t("Toplam konut")}</span><strong>{project.totalUnits}</strong></div>}
          <div><span><MapPin size={14}/> {t("Konum")}</span><strong>{place}</strong></div>
        </section>
        <section><h2>{t("Proje hakkında")}</h2><p className="project-description">{project.description}</p></section>
        <section><h2>{t("Konut tipleri")}</h2><div className="project-unit-table"><table><thead><tr><th>{t("Oda sayısı")}</th><th>{t("Alan")}</th><th>{t("Başlangıç fiyatı")}</th></tr></thead><tbody>{project.unitTypes.map((unit) => <tr key={unit.rooms}><td>{unit.rooms === "1+0" ? `${t("Stüdyo")} (1+0)` : unit.rooms}</td><td>{unit.minArea === unit.maxArea ? unit.minArea : `${unit.minArea}–${unit.maxArea}`} m²</td><td>{formatPrice(unit.priceFrom, unit.currency, locale)}</td></tr>)}</tbody></table></div></section>
        {project.amenities.length > 0 && <section><h2>{t("Proje özellikleri")}</h2><ul className="project-amenities">{project.amenities.map((item) => <li key={item}><CheckCircle2 size={16}/>{t(item)}</li>)}</ul></section>}
        <section className="project-publisher"><h2>{t("Projeyi yayınlayan")}</h2><p><strong>{project.ownerName}</strong>{project.ownerVerified && <VerifiedBadge/>}</p>{project.website && <a href={project.website} target="_blank" rel="noopener noreferrer nofollow" className="text-link">{t("Proje web sitesi")} <ExternalLink size={14}/></a>}</section>
      </div>
      <aside className="project-detail-side"><ReservationForm project={project}/></aside>
    </div>
  </div></main>;
}
