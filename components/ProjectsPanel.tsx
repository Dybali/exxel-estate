"use client";
import { ForwardArrow, BackArrow } from "@/components/DirectionalArrow";
import {useCallback, useEffect, useRef, useState} from "react";
import Link from "@/components/SafeLink";
import {Building2, Pencil, Plus, Trash2, X} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {AMENITIES} from "@/lib/listings";
import {CITIES, districtsFor} from "@/lib/turkey-locations";
import {ROOM_OPTIONS} from "@/lib/search-categories";
import {optimizeListingPhoto} from "@/lib/photo-optimize";
import {MAX_PROJECT_IMAGES, MAX_UNIT_TYPES, PROJECT_CURRENCIES, PROJECT_MODERATION_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, RESERVATION_STATUSES, RESERVATION_STATUS_LABELS, type Project, type Reservation, type ReservationStatus} from "@/lib/projects";

type Unit = {rooms: string; minArea: string; maxArea: string; priceFrom: string; currency: string};
type Form = {name: string; description: string; city: string; district: string; neighborhood: string; status: string; deliveryDate: string; totalUnits: string; website: string; amenities: string[]; images: string[]; unitTypes: Unit[]};
const emptyUnit = (): Unit => ({rooms: "", minArea: "", maxArea: "", priceFrom: "", currency: "TRY"});
const emptyForm = (): Form => ({name: "", description: "", city: "", district: "", neighborhood: "", status: "ongoing", deliveryDate: "", totalUnits: "", website: "", amenities: [], images: [], unitTypes: [emptyUnit()]});
const formFrom = (project: Project): Form => ({name: project.name, description: project.description, city: project.city, district: project.district, neighborhood: project.neighborhood || "", status: project.status, deliveryDate: project.deliveryDate || "", totalUnits: project.totalUnits ? String(project.totalUnits) : "", website: project.website || "", amenities: project.amenities, images: project.images,
  unitTypes: project.unitTypes.map((unit) => ({rooms: unit.rooms, minArea: String(unit.minArea), maxArea: String(unit.maxArea), priceFrom: String(unit.priceFrom), currency: unit.currency}))});

function ProjectForm({project, onSaved, onCancel}: {project: Project | null; onSaved: (moderation: string) => void; onCancel: () => void}) {
  const {t} = useLocale();
  const [form, setForm] = useState<Form>(project ? formFrom(project) : emptyForm());
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const latest = useRef(form); latest.current = form;
  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((old) => ({...old, [key]: event.target.value, ...(key === "city" ? {district: ""} : {})}));
  const setUnit = (index: number, key: keyof Unit, value: string) => setForm((old) => ({...old, unitTypes: old.unitTypes.map((unit, i) => i === index ? {...unit, [key]: value} : unit)}));
  async function upload(files: FileList | null) {
    if (!files || uploading) return;
    setUploading(true); setError("");
    for (const file of Array.from(files).slice(0, MAX_PROJECT_IMAGES - latest.current.images.length)) {
      try {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 40000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
        const prepared = await optimizeListingPhoto(file).catch(() => file);
        if (prepared.size > 8000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
        const body = new FormData(); body.append("file", prepared);
        const response = await fetch("/api/media", {method: "POST", body}), data = await apiJson<{url?: string; error?: string}>(response);
        if (!response.ok || !data.url) throw new Error(data.error || "Fotoğraf yüklenemedi.");
        const url = data.url;
        setForm((old) => ({...old, images: [...old.images, url]}));
      } catch (cause) { setError((cause as Error).message); }
    }
    setUploading(false);
  }
  const move = (index: number, step: number) => setForm((old) => { const images = [...old.images], target = index + step; if (target < 0 || target >= images.length) return old; [images[index], images[target]] = [images[target], images[index]]; return {...old, images}; });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    setBusy(true); setError("");
    try {
      const payload = {...form, totalUnits: form.totalUnits || null, unitTypes: form.unitTypes.map((unit) => ({...unit, maxArea: unit.maxArea || unit.minArea}))};
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {method: project ? "PATCH" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
      const data = await apiJson<{error?: string; moderation?: string}>(response);
      if (!response.ok) throw new Error(data.error || "Proje kaydedilemedi.");
      onSaved(data.moderation || "pending");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <form className="project-editor" onSubmit={submit}>
    <div className="project-editor-head"><h3>{t(project ? "Projeyi düzenle" : "Yeni proje")}</h3><button type="button" className="icon-button" onClick={onCancel} aria-label={t("Kapat")}><X size={18}/></button></div>
    <p className="project-editor-note">{t("Projeler yönetici onayından sonra yayınlanır. Yaptığınız her değişiklik projeyi yeniden incelemeye gönderir.")}</p>
    <label>{t("Proje adı")}<input required minLength={5} maxLength={120} value={form.name} onChange={set("name")}/></label>
    <label>{t("Proje açıklaması")}<textarea required minLength={30} maxLength={5000} rows={6} value={form.description} onChange={set("description")}/></label>
    <div className="project-editor-grid">
      <label>{t("Şehir")}<select required value={form.city} onChange={set("city")}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
      <label>{t("İlçe")}<select required value={form.district} onChange={set("district")} disabled={!form.city}><option value="">{t("Seçin")}</option>{districtsFor(form.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
      <label>{t("Mahalle (isteğe bağlı)")}<input maxLength={80} value={form.neighborhood} onChange={set("neighborhood")}/></label>
      <label>{t("Proje durumu")}<select value={form.status} onChange={set("status")}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{t(PROJECT_STATUS_LABELS[status])}</option>)}</select></label>
      <label>{t("Teslim tarihi (isteğe bağlı)")}<input type="month" min="2000-01" max="2100-12" value={form.deliveryDate} onChange={set("deliveryDate")}/></label>
      <label>{t("Toplam konut sayısı (isteğe bağlı)")}<input inputMode="numeric" pattern="\d*" maxLength={6} value={form.totalUnits} onChange={set("totalUnits")}/></label>
      <label className="project-editor-wide">{t("Proje web sitesi (isteğe bağlı)")}<input type="url" maxLength={300} placeholder="https://" value={form.website} onChange={set("website")}/></label>
    </div>
    <fieldset className="project-units"><legend>{t("Konut tipleri")}</legend>
      <datalist id="project-room-options">{ROOM_OPTIONS.map((rooms) => <option key={rooms} value={rooms}/>)}</datalist>
      {form.unitTypes.map((unit, index) => <div className="project-unit-row" key={index}>
        <label>{t("Oda sayısı")}<input required list="project-room-options" maxLength={10} placeholder="3+1" value={unit.rooms} onChange={(event) => setUnit(index, "rooms", event.target.value)}/></label>
        <label>{t("En küçük m²")}<input required inputMode="numeric" pattern="\d*" maxLength={6} value={unit.minArea} onChange={(event) => setUnit(index, "minArea", event.target.value)}/></label>
        <label>{t("En büyük m²")}<input inputMode="numeric" pattern="\d*" maxLength={6} value={unit.maxArea} onChange={(event) => setUnit(index, "maxArea", event.target.value)}/></label>
        <label>{t("Başlangıç fiyatı")}<input required inputMode="numeric" pattern="\d*" maxLength={13} value={unit.priceFrom} onChange={(event) => setUnit(index, "priceFrom", event.target.value)}/></label>
        <label>{t("Para birimi")}<select value={unit.currency} onChange={(event) => setUnit(index, "currency", event.target.value)}>{PROJECT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        <button type="button" className="icon-button" disabled={form.unitTypes.length < 2} onClick={() => setForm((old) => ({...old, unitTypes: old.unitTypes.filter((_, i) => i !== index)}))} aria-label={t("Konut tipini kaldır")}><Trash2 size={16}/></button>
      </div>)}
      {form.unitTypes.length < MAX_UNIT_TYPES && <button type="button" className="outline-button" onClick={() => setForm((old) => ({...old, unitTypes: [...old.unitTypes, emptyUnit()]}))}><Plus size={16}/>{t("Konut tipi ekle")}</button>}
    </fieldset>
    <fieldset className="project-amenity-picker"><legend>{t("Proje özellikleri")}</legend>{AMENITIES.map((item) => <label key={item}><input type="checkbox" checked={form.amenities.includes(item)} onChange={(event) => setForm((old) => ({...old, amenities: event.target.checked ? [...old.amenities, item] : old.amenities.filter((value) => value !== item)}))}/>{t(item)}</label>)}</fieldset>
    <fieldset className="project-photos"><legend>{t("Fotoğraflar")}</legend>
      <p>{t("İlk fotoğraf kapak olarak gösterilir. En fazla 30 fotoğraf ekleyebilirsiniz.")}</p>
      <div className="project-photo-grid">{form.images.map((src, index) => <figure key={src}><img src={src} alt=""/><figcaption><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("Öne al")}><BackArrow size={14}/></button><button type="button" disabled={index === form.images.length - 1} onClick={() => move(index, 1)} aria-label={t("Geriye al")}><ForwardArrow size={14}/></button><button type="button" onClick={() => setForm((old) => ({...old, images: old.images.filter((value) => value !== src)}))} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figcaption></figure>)}</div>
      {form.images.length < MAX_PROJECT_IMAGES && <label className="outline-button project-upload">{t(uploading ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={uploading} onChange={(event) => { void upload(event.target.files); event.target.value = ""; }}/></label>}
    </fieldset>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="project-editor-actions"><button type="submit" className="small-primary" disabled={busy || uploading}>{t(busy ? "Kaydediliyor..." : project ? "Değişiklikleri kaydet" : "Onaya gönder")}</button><button type="button" className="outline-button" onClick={onCancel}>{t("Vazgeç")}</button></div>
  </form>;
}

function ReservationRow({item, onChange}: {item: Reservation; onChange: (status: ReservationStatus) => void}) {
  const {t, locale} = useLocale();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function update(status: ReservationStatus) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/projects/mine", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: item.id, status})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "Talep güncellenemedi.");
      onChange(status);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <li className={`lead-row project-reservation-row status-${item.status}`}>
    <div className="lead-head"><strong>{item.name}</strong><span>{new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(item.createdAt))}</span></div>
    <p className="lead-listing"><Link href={`/projeler/${item.projectId}`}>{item.projectName}</Link> · {item.unitType === "1+0" ? t("Stüdyo") : item.unitType}</p>
    <p className="project-reservation-contact"><a href={`tel:${item.phone}`}>{item.phone}</a> · <a href={`mailto:${item.email}`}>{item.email}</a></p>
    {item.message && <p className="project-reservation-message">{item.message}</p>}
    <div className="lead-edit"><label>{t("Durum")}<select value={item.status} disabled={busy} onChange={(event) => void update(event.target.value as ReservationStatus)}>{RESERVATION_STATUSES.map((status) => <option key={status} value={status}>{t(RESERVATION_STATUS_LABELS[status])}</option>)}</select></label></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </li>;
}

// Dashboard tab "Projelerim": own projects with moderation state, editor and received reservation requests.
export function ProjectsPanel() {
  const {t} = useLocale();
  const [data, setData] = useState<{allowed: boolean; projects: Project[]; reservations: Reservation[]} | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [filter, setFilter] = useState<ReservationStatus | "all">("all");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/projects/mine", {cache: "no-store"});
      const result = await apiJson<{error?: string; allowed: boolean; projects: Project[]; reservations: Reservation[]}>(response);
      if (!response.ok) throw new Error(result.error || "Projeler yüklenemedi.");
      setData(result); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove(project: Project) {
    if (!window.confirm(t("Bu proje ve gelen tüm talepler kalıcı olarak silinsin mi?"))) return;
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, {method: "DELETE"});
      const result = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(result.error || "Proje silinemedi.");
      setNotice("Proje silindi."); void load();
    } catch (cause) { setError((cause as Error).message); }
  }
  const reservations = data?.reservations || [];
  const visible = reservations.filter((item) => filter === "all" || item.status === filter);
  return <section className="projects-panel">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("KONUT PROJELERİ")}</span><h2>{t("Projelerim")}</h2></div>{data?.allowed && !editing && <button type="button" className="small-primary" onClick={() => { setNotice(""); setEditing("new"); }}>{t("Yeni proje")}<Plus size={17}/></button>}</div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {notice && <p className="profile-save-success" role="status">{t(notice)}</p>}
    {!data && !error && <p>{t("Projeler yükleniyor...")}</p>}
    {data && !data.allowed && <div className="panel-note"><h3>{t("Proje eklemek için onay gerekir")}</h3><p>{t("Projeleri yalnızca yönetici tarafından onaylanmış emlakçılar ve inşaat firmaları yayınlayabilir. Ofis yetki belgenizi Profilim bölümünden incelemeye gönderin.")}</p><Link className="text-link" href="/hesabim?tab=profil">{t("Profilime git")}</Link></div>}
    {editing && <ProjectForm key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={(moderation) => { setEditing(null); setNotice(moderation === "approved" ? "Proje kaydedildi." : "Projeniz incelemeye gönderildi. Onaylandığında yayınlanır."); void load(); }}/>}
    {data && (data.projects.length ? <ul className="project-owner-list">{data.projects.map((project) => <li key={project.id}>
      {project.images[0] ? <img src={project.images[0]} alt=""/> : <span className="project-owner-thumb"><Building2 size={24}/></span>}
      <div><strong>{project.name}</strong><small>{project.district}, {project.city}</small>
        <span className={`admin-badge project-moderation ${project.moderation}`}>{t(PROJECT_MODERATION_LABELS[project.moderation])}</span>
        {project.moderation === "rejected" && project.reviewNote && <p className="project-review-note">{t("Yönetici notu")}: {project.reviewNote}</p>}
        <small>{t("{n} talep").replace("{n}", String(project.reservations || 0))}{project.newReservations ? ` · ${t("{n} yeni").replace("{n}", String(project.newReservations))}` : ""}</small>
      </div>
      <div className="project-owner-actions"><Link className="outline-button" href={`/projeler/${project.id}`}>{t("Görüntüle")}</Link>{data.allowed && <button type="button" className="outline-button" onClick={() => { setNotice(""); setEditing(project); }}><Pencil size={14}/>{t("Düzenle")}</button>}<button type="button" className="outline-button danger" onClick={() => void remove(project)}><Trash2 size={14}/>{t("Sil")}</button></div>
    </li>)}</ul> : data.allowed && !editing && <div className="panel-empty"><Building2 size={28}/><h3>{t("Henüz proje eklemediniz.")}</h3><button type="button" onClick={() => setEditing("new")}>{t("İlk projenizi ekleyin")}<ForwardArrow/></button></div>)}
    {data && (data.projects.length > 0 || reservations.length > 0) && <section className="leads-panel project-reservations">
      <h2>{t("Yer ayırtma talepleri")}</h2>
      <p className="leads-intro">{t("Projelerinize gelen talepler burada listelenir. Kişilerle telefon veya e-posta ile iletişime geçin ve durumu güncelleyin.")}</p>
      <div className="leads-filters" role="group" aria-label={t("Durum")}><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t("Tümü")} · {reservations.length}</button>{RESERVATION_STATUSES.map((status) => <button type="button" key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{t(RESERVATION_STATUS_LABELS[status])} · {reservations.filter((item) => item.status === status).length}</button>)}</div>
      {visible.length ? <ul className="leads-list">{visible.map((item) => <ReservationRow key={item.id} item={item} onChange={(status) => setData((old) => old ? {...old, reservations: old.reservations.map((row) => row.id === item.id ? {...row, status} : row)} : old)}/>)}</ul> : <p className="leads-empty">{t("Henüz yer ayırtma talebi yok.")}</p>}
    </section>}
  </section>;
}
