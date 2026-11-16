"use client";
import { CONTRACTOR_TILES, FirmStatsPanel } from "@/components/ServiceFirmTools";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, HardHat, ImagePlus, Inbox, Pencil, Plus, Trash2, X, BarChart3 } from "lucide-react";
import Link from "@/components/SafeLink";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { appendPhotoVariants, preparePhotoUpload } from "@/lib/photo-optimize";
import { CONTRACTOR_BASE, CONTRACTOR_LIMITS, CONTRACTOR_SPECIALTIES, CONTRACTOR_STATUS_LABELS, contractorPath, LAND_PATH, zoningName, type ContractorArea, type ContractorFirm, type LandOffer, type LandRequest } from "@/lib/contractors";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

type ProjectForm = { id?: string; title: string; city: string; district: string; year: string; kind: string; units: string; description: string; photos: string[] };
type Form = {
  name: string; description: string; specialties: string[]; areas: ContractorArea[]; phone: string; whatsapp: string; email: string; website: string; foundedYear: string; licenseNumber: string;
  landDeals: boolean; logo: string | null; cover: string | null; projects: ProjectForm[]; taxOffice: string; taxNumber: string; terms: boolean;
};
const emptyProject = (): ProjectForm => ({ title: "", city: "", district: "", year: "", kind: "konut", units: "", description: "", photos: [] });
const formFrom = (firm: ContractorFirm | null): Form => firm ? {
  name: firm.name, description: firm.description, specialties: [...firm.specialties], areas: firm.areas.map((area) => ({ ...area })), phone: firm.phone, whatsapp: firm.whatsapp || "", email: firm.email || "",
  website: firm.website || "", foundedYear: firm.foundedYear ? String(firm.foundedYear) : "", licenseNumber: firm.licenseNumber || "", landDeals: firm.landDeals, logo: firm.logo, cover: firm.cover,
  projects: firm.projects.map((project) => ({ ...project, year: String(project.year), units: project.units ? String(project.units) : "", photos: [...project.photos] })), taxOffice: firm.taxOffice || "", taxNumber: firm.taxNumber || "", terms: true,
} : { name: "", description: "", specialties: [], areas: [], phone: "", whatsapp: "", email: "", website: "", foundedYear: "", licenseNumber: "", landDeals: true, logo: null, cover: null, projects: [], taxOffice: "", taxNumber: "", terms: false };

// Uploads one photo through the listing photo pipeline (resize in the browser, signature check and R2 on the server).
async function uploadPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 40000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
  const { file: prepared, variants } = await preparePhotoUpload(file);
  if (prepared.size > 8000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
  const body = new FormData(); body.append("file", prepared); appendPhotoVariants(body, variants);
  const response = await fetch("/api/media?purpose=contractor", { method: "POST", body }), data = await apiJson<{ url?: string; error?: string }>(response);
  if (!response.ok || !data.url) throw new Error(data.error || "Fotoğraf yüklenemedi.");
  return data.url;
}

function ContractorForm({ firm, onSaved, onCancel }: { firm: ContractorFirm | null; onSaved: (status: string) => void; onCancel: () => void }) {
  const { t } = useLocale();
  const [form, setForm] = useState<Form>(() => formFrom(firm));
  const [place, setPlace] = useState({ city: "", district: "" });
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(""), [error, setError] = useState("");
  const latest = useRef(form); latest.current = form;
  const set = (key: "name" | "description" | "phone" | "whatsapp" | "email" | "website" | "foundedYear" | "licenseNumber" | "taxOffice" | "taxNumber") => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const setProject = (index: number, patch: Partial<ProjectForm>) => setForm((old) => ({ ...old, projects: old.projects.map((project, i) => i === index ? { ...project, ...patch } : project) }));
  function addArea() {
    if (!place.city) return;
    setForm((old) => {
      if (old.areas.some((area) => area.city === place.city && (area.district === place.district || !area.district))) return old;
      // Choosing the whole province replaces its single districts.
      const rest = place.district ? old.areas : old.areas.filter((area) => area.city !== place.city);
      return { ...old, areas: [...rest, { city: place.city, district: place.district }].slice(0, CONTRACTOR_LIMITS.areas) };
    });
    setPlace((old) => ({ ...old, district: "" }));
  }
  async function upload(target: "logo" | "cover" | number, files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(String(target)); setError("");
    const room = typeof target === "number" ? CONTRACTOR_LIMITS.projectPhotos - latest.current.projects[target].photos.length : 1;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const url = await uploadPhoto(file);
        setForm((old) => typeof target === "number" ? { ...old, projects: old.projects.map((project, i) => i === target ? { ...project, photos: [...project.photos, url] } : project) } : { ...old, [target]: url });
      } catch (cause) { setError((cause as Error).message); }
    }
    setUploading("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    if (!form.specialties.length) { setError("En az bir uzmanlık alanı seçin."); return; }
    if (!form.areas.length) { setError("En az bir, en fazla 30 çalışma bölgesi seçin."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractors/mine", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await apiJson<{ error?: string; status?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Firma kaydedilemedi.");
      onSaved(data.status || "pending");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const image = (kind: "logo" | "cover", label: string) => <div className={`service-upload service-upload-${kind}`}>
    <span>{t(label)}</span>
    {form[kind] ? <figure><img src={form[kind]!} alt=""/><button type="button" onClick={() => setForm((old) => ({ ...old, [kind]: null }))} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figure>
      : <label className="outline-button"><ImagePlus size={16}/>{t(uploading === kind ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(uploading)} onChange={(event) => { void upload(kind, event.target.files); event.target.value = ""; }}/></label>}
  </div>;
  const year = new Date().getFullYear();
  return <form className="project-editor service-editor" onSubmit={submit}>
    <div className="project-editor-head"><h3>{t(firm ? "Firma profilini düzenle" : "Yeni müteahhit firması")}</h3><button type="button" className="icon-button" onClick={onCancel} aria-label={t("Kapat")}><X size={18}/></button></div>
    <p className="project-editor-note">{t("Firma profilleri yönetici onayından sonra yayınlanır. Yaptığınız her değişiklik profili yeniden incelemeye gönderir.")}</p>
    <div className="project-editor-grid">
      <label>{t("Firma adı")}<input required minLength={CONTRACTOR_LIMITS.nameMin} maxLength={CONTRACTOR_LIMITS.nameMax} value={form.name} onChange={set("name")}/></label>
      <label>{t("Kuruluş yılı (isteğe bağlı)")}<input type="number" inputMode="numeric" min={1900} max={year} value={form.foundedYear} onChange={set("foundedYear")}/></label>
    </div>
    <fieldset className="service-category-picker"><legend>{t("Uzmanlık alanları")} <small>({form.specialties.length}/{CONTRACTOR_LIMITS.specialties})</small></legend>
      <div>{CONTRACTOR_SPECIALTIES.map((item) => { const checked = form.specialties.includes(item.slug); return <label key={item.slug}><input type="checkbox" checked={checked} onChange={(event) => setForm((old) => ({ ...old, specialties: event.target.checked ? [...old.specialties, item.slug] : old.specialties.filter((slug) => slug !== item.slug) }))}/>{t(item.name)}</label>; })}</div>
    </fieldset>
    <fieldset className="service-area-picker"><legend>{t("Çalıştığı bölgeler")} <small>({form.areas.length}/{CONTRACTOR_LIMITS.areas})</small></legend>
      <p>{t("Kat karşılığı talepleri bu bölgelerdeki arsalar için size gönderilir.")}</p>
      <div className="service-area-add">
        <label>{t("İl")}<select value={place.city} onChange={(event) => setPlace({ city: event.target.value, district: "" })}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>{t("İlçe")}<select value={place.district} disabled={!place.city} onChange={(event) => setPlace((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm il")}</option>{districtsFor(place.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
        <button type="button" className="outline-button" disabled={!place.city || form.areas.length >= CONTRACTOR_LIMITS.areas} onClick={addArea}><Plus size={16}/>{t("Bölge ekle")}</button>
      </div>
      {form.areas.length > 0 && <ul className="service-area-chips">{form.areas.map((area) => <li key={`${area.city}|${area.district}`}>{area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`}<button type="button" onClick={() => setForm((old) => ({ ...old, areas: old.areas.filter((item) => item !== area) }))} aria-label={t("Bölgeyi kaldır")}><X size={13}/></button></li>)}</ul>}
    </fieldset>
    <label className="service-terms"><input type="checkbox" checked={form.landDeals} onChange={(event) => setForm((old) => ({ ...old, landDeals: event.target.checked }))}/>{t("Kat karşılığı arsa değerlendiriyoruz (bölgemdeki arsa sahiplerinden talep alırım).")}</label>
    <label>{t("Firma açıklaması")}<textarea required minLength={CONTRACTOR_LIMITS.descriptionMin} maxLength={CONTRACTOR_LIMITS.descriptionMax} rows={6} value={form.description} onChange={set("description")} placeholder={t("Hangi tür projeler yaptığınızı, deneyiminizi ve çalışma şeklinizi yazın.")}/></label>
    <div className="project-editor-grid">
      <label>{t("Firma telefonu")}<input required type="tel" inputMode="tel" maxLength={25} placeholder="0532 123 45 67" value={form.phone} onChange={set("phone")}/></label>
      <label>{t("WhatsApp numarası (isteğe bağlı)")}<input type="tel" inputMode="tel" maxLength={25} value={form.whatsapp} onChange={set("whatsapp")}/></label>
      <label>{t("Firma e-postası (isteğe bağlı)")}<input type="email" maxLength={254} value={form.email} onChange={set("email")}/></label>
      <label>{t("Web sitesi (isteğe bağlı)")}<input type="url" maxLength={300} placeholder="https://" value={form.website} onChange={set("website")}/></label>
    </div>
    <p className="project-editor-note">{t("Telefon, WhatsApp, e-posta ve web sitesi onaydan sonra profilinizde herkese açık gösterilir.")}</p>
    <fieldset className="project-photos service-photo-editor"><legend>{t("Logo ve kapak")}</legend>
      <div className="service-upload-row">{image("logo", "Logo")}{image("cover", "Kapak fotoğrafı")}</div>
    </fieldset>
    <fieldset className="ctr-project-editor"><legend>{t("Tamamlanan projeler")} <small>({form.projects.length}/{CONTRACTOR_LIMITS.projects})</small></legend>
      <p>{t("Teslim ettiğiniz projeler profilinizde listelenir; arsa sahipleri en çok buna bakar.")}</p>
      {form.projects.map((project, index) => <div key={project.id || index} className="ctr-project-form">
        <div className="ctr-project-form-head"><strong>{t("{n}. proje").replace("{n}", String(index + 1))}</strong><button type="button" className="icon-button" onClick={() => setForm((old) => ({ ...old, projects: old.projects.filter((_, i) => i !== index) }))} aria-label={t("Projeyi kaldır")}><Trash2 size={15}/></button></div>
        <div className="project-editor-grid">
          <label>{t("Proje adı")}<input required minLength={3} maxLength={120} value={project.title} onChange={(event) => setProject(index, { title: event.target.value })}/></label>
          <label>{t("Proje türü")}<select value={project.kind} onChange={(event) => setProject(index, { kind: event.target.value })}>{CONTRACTOR_SPECIALTIES.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>
          <label>{t("İl")}<select required value={project.city} onChange={(event) => setProject(index, { city: event.target.value, district: "" })}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label>{t("İlçe")}<select value={project.district} disabled={!project.city} onChange={(event) => setProject(index, { district: event.target.value })}><option value="">{t("Seçin")}</option>{districtsFor(project.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
          <label>{t("Tamamlanma yılı")}<input required type="number" inputMode="numeric" min={1950} max={year} value={project.year} onChange={(event) => setProject(index, { year: event.target.value })}/></label>
          <label>{t("Bağımsız bölüm sayısı (isteğe bağlı)")}<input type="number" inputMode="numeric" min={1} max={100000} value={project.units} onChange={(event) => setProject(index, { units: event.target.value })}/></label>
        </div>
        <label>{t("Kısa açıklama (isteğe bağlı)")}<textarea rows={2} maxLength={1000} value={project.description} onChange={(event) => setProject(index, { description: event.target.value })}/></label>
        <div className="project-photo-grid">{project.photos.map((src) => <figure key={src}><img src={src} alt=""/><figcaption><button type="button" onClick={() => setProject(index, { photos: project.photos.filter((value) => value !== src) })} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figcaption></figure>)}</div>
        {project.photos.length < CONTRACTOR_LIMITS.projectPhotos && <label className="outline-button project-upload"><ImagePlus size={16}/>{t(uploading === String(index) ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={Boolean(uploading)} onChange={(event) => { void upload(index, event.target.files); event.target.value = ""; }}/></label>}
      </div>)}
      {form.projects.length < CONTRACTOR_LIMITS.projects && <button type="button" className="outline-button" onClick={() => setForm((old) => ({ ...old, projects: [...old.projects, emptyProject()] }))}><Plus size={16}/>{t("Tamamlanan proje ekle")}</button>}
    </fieldset>
    <fieldset className="service-tax"><legend>{t("Yetki belgesi ve vergi bilgileri")}</legend>
      <p>{t("Yetki belgesi numarası profilinizde gösterilir; yönetici kontrol ettikten sonra \"Doğrulanmış müteahhit\" rozeti alırsınız. Vergi bilgilerini yalnızca yöneticiler görür.")}</p>
      <div className="project-editor-grid">
        <label>{t("Yapı müteahhitliği yetki belgesi no")}<input maxLength={40} value={form.licenseNumber} onChange={set("licenseNumber")}/></label>
        <label>{t("Vergi dairesi")}<input maxLength={80} value={form.taxOffice} onChange={set("taxOffice")}/></label>
        <label>{t("Vergi numarası veya T.C. kimlik numarası")}<input inputMode="numeric" pattern="\d{10,11}" maxLength={11} value={form.taxNumber} onChange={set("taxNumber")}/></label>
      </div>
    </fieldset>
    {!firm && <label className="service-terms"><input type="checkbox" required checked={form.terms} onChange={(event) => setForm((old) => ({ ...old, terms: event.target.checked }))}/>{t("Bilgilerin doğru olduğunu ve firma profilimin iletişim bilgileriyle birlikte herkese açık yayınlanmasını onaylıyorum.")}</label>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="project-editor-actions"><button type="submit" className="small-primary" disabled={busy || Boolean(uploading)}>{t(busy ? "Kaydediliyor..." : firm ? "Değişiklikleri kaydet" : "Onaya gönder")}</button><button type="button" className="outline-button" onClick={onCancel}>{t("Vazgeç")}</button></div>
  </form>;
}

type InboxRequest = LandRequest & { state: string; offer: { ownerShare: number; deliveryMonths: number; message: string; state: string } | null };
const placeLabel = (request: Pick<LandRequest, "city" | "district">) => request.district ? `${request.district}, ${request.city}` : request.city;

function LandFacts({ request }: { request: LandRequest }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <p className="ctr-land-facts"><span>{number(request.areaM2)} m²</span><span>{t(zoningName(request.zoning))}</span>{request.emsal && <span>{t("Emsal")} {request.emsal}</span>}{request.expectedShare && <span>{t("Beklenen pay")} %{request.expectedShare}</span>}</p>;
}
const STATUS: Record<LandRequest["status"], string> = { open: "Açık", accepted: "Anlaşma sağlandı", closed: "Kapatıldı", expired: "Süresi doldu" };

/** Requests that reached the firm, with the one-time offer form. */
function ContractorInbox({ approved, onSeen }: { approved: boolean; onSeen: () => void }) {
  const { t, locale } = useLocale();
  const [requests, setRequests] = useState<InboxRequest[] | null>(null), [error, setError] = useState(""), [open, setOpen] = useState(""), [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState({ ownerShare: "", deliveryMonths: "", message: "" });
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/contractors/mine/land", { cache: "no-store" }), data = await apiJson<{ error?: string; requests?: InboxRequest[] }>(response);
      if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi.");
      setRequests(data.requests || []); onSeen();
    } catch (cause) { setError((cause as Error).message); }
  }, [onSeen]);
  useEffect(() => { void load(); }, [load]);
  async function act(requestId: string, action: "offer" | "pass") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractors/mine/land", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestId, ...offer }) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      setOpen(""); setOffer({ ownerShare: "", deliveryMonths: "", message: "" }); await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  if (requests === null) return error ? <p className="form-error" role="alert">{t(error)}</p> : <p>{t("Yükleniyor...")}</p>;
  return <div className="svc-inbox">
    {!approved && <p className="project-editor-note">{t("Firmanız yayında olmadığı için yeni talep almıyorsunuz ve teklif veremezsiniz.")}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!requests.length && <div className="panel-empty"><Inbox size={26}/><p>{t("Henüz kat karşılığı talebi gelmedi. Talepler çalıştığınız bölgelerdeki arsalar için gönderilir.")}</p></div>}
    {requests.map((request) => <article key={request.id} className="svc-inbox-item">
      <header><strong>{placeLabel(request)}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <LandFacts request={request}/>
      <p dir="auto">{request.description}</p>
      <p className="service-account-meta">{request.name} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(request.createdAt))}
        {request.email ? <> · <a href={`mailto:${request.email}`}>{request.email}</a>{request.phone && <> · <a href={`tel:${request.phone}`}><bdi>{request.phone}</bdi></a></>}</> : <> · {t("İletişim bilgileri teklifiniz kabul edilince görünür.")}</>}</p>
      {request.offer ? <p className="ctr-offer-sent"><CheckCircle2 size={16} aria-hidden="true"/>{t("Teklifiniz: arsa sahibine %{p}, {m} ay teslim.").replace("{p}", String(request.offer.ownerShare)).replace("{m}", String(request.offer.deliveryMonths))} <strong>{t(request.offer.state === "accepted" ? "Kabul edildi" : request.offer.state === "declined" ? "Seçilmedi" : "Yanıt bekleniyor")}</strong></p>
        : request.state === "passed" ? <p className="service-account-meta">{t("Bu talebi geçtiniz.")}</p>
        : approved && request.status === "open" && (open === request.id ? <form className="ctr-offer-form" onSubmit={(event) => { event.preventDefault(); void act(request.id, "offer"); }}>
          <div className="project-editor-grid">
            <label>{t("Arsa sahibine kalacak pay (%)")}<input required type="number" min={1} max={99} value={offer.ownerShare} onChange={(event) => setOffer((old) => ({ ...old, ownerShare: event.target.value }))}/></label>
            <label>{t("Teslim süresi (ay)")}<input required type="number" min={1} max={120} value={offer.deliveryMonths} onChange={(event) => setOffer((old) => ({ ...old, deliveryMonths: event.target.value }))}/></label>
          </div>
          <label>{t("Teklif açıklaması")}<textarea required rows={4} minLength={10} maxLength={2000} value={offer.message} onChange={(event) => setOffer((old) => ({ ...old, message: event.target.value }))} placeholder={t("Örn. kaç bağımsız bölüm planladığınız, kira yardımı, ruhsat ve teminat koşulları.")}/></label>
          <div className="project-editor-actions"><button type="submit" className="small-primary" disabled={busy}>{t(busy ? "Gönderiliyor..." : "Teklifi gönder")}</button><button type="button" className="outline-button" onClick={() => setOpen("")}>{t("Vazgeç")}</button></div>
        </form> : <div className="project-editor-actions"><button type="button" className="small-primary" onClick={() => setOpen(request.id)}>{t("Teklif ver")}</button><button type="button" className="outline-button" disabled={busy} onClick={() => void act(request.id, "pass")}>{t("Geç")}</button></div>)}
    </article>)}
  </div>;
}

// Hesabım tab "Müteahhit firmam": one contractor firm per member, independent of the account role.
export function ContractorPanel() {
  const { t, locale } = useLocale();
  const [firm, setFirm] = useState<ContractorFirm | null | undefined>(undefined), [unseen, setUnseen] = useState(0);
  // ?bolum=talepler (links in the request e-mails) opens the requests directly.
  const [section, setSection] = useState<"profil" | "talepler" | "istatistik">(() => { const wanted = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("bolum") : null; return wanted === "talepler" || wanted === "istatistik" ? wanted : "profil"; });
  const [editing, setEditing] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const seen = useCallback(() => setUnseen(0), []);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/contractors/mine", { cache: "no-store" }), data = await apiJson<{ error?: string; firm: ContractorFirm | null; newRequests?: number }>(response);
      if (!response.ok) throw new Error(data.error || "Firma bilgileri yüklenemedi.");
      setFirm(data.firm); setUnseen(data.newRequests || 0); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove() {
    if (!window.confirm(t("Firma profiliniz ve fotoğrafları kalıcı olarak silinsin mi?"))) return;
    setNotice("");
    try {
      const response = await fetch("/api/contractors/mine", { method: "DELETE" }), data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Firma silinemedi.");
      setFirm(null); setNotice("Firma profiliniz silindi.");
    } catch (cause) { setError((cause as Error).message); }
  }
  return <section className="service-account">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("MÜTEAHHİTLER")}</span><h2>{t("Müteahhit firmam")}</h2></div>
      {firm === null && !editing && <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}>{t("Firma profili oluştur")}<Plus size={17}/></button>}</div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {notice && <p className="profile-save-success" role="status">{t(notice)}</p>}
    {firm === undefined && !error && <p>{t("Yükleniyor...")}</p>}
    {editing && firm !== undefined && <ContractorForm firm={firm} onCancel={() => setEditing(false)} onSaved={(status) => { setEditing(false); setNotice(status === "approved" ? "Değişiklikler kaydedildi." : status === "suspended" ? "Değişiklikler kaydedildi. Profiliniz askıda olduğu için yayında değil." : "Firma profiliniz incelemeye gönderildi. Onaylandığında yayınlanır."); void load(); }}/>}
    {!editing && firm === null && <div className="panel-empty service-account-intro"><HardHat size={28}/><h3>{t("Müteahhitseniz firmanızı ekleyin")}</h3>
      <p>{t("Konut, villa, ticari veya kentsel dönüşüm projeleri yapan firmalar Müteahhitler bölümünde ücretsiz profil açabilir ve arsa sahiplerinden kat karşılığı talebi alabilir.")}</p>
      <Link href={CONTRACTOR_BASE}>{t("Müteahhitler bölümünü görün")}<ExternalLink size={15}/></Link></div>}
    {!editing && firm && <nav className="svc-panel-tabs" aria-label={t("Firma paneli")}>
      <button type="button" aria-pressed={section === "profil"} onClick={() => setSection("profil")}><HardHat size={16} aria-hidden="true"/>{t("Profil")}</button>
      <button type="button" aria-pressed={section === "talepler"} onClick={() => setSection("talepler")}><Inbox size={16} aria-hidden="true"/>{t("Kat karşılığı talepleri")}{unseen > 0 && <b className="svc-tab-count" aria-label={t("{n} yeni").replace("{n}", String(unseen))}>{unseen}</b>}</button>
      <button type="button" aria-pressed={section === "istatistik"} onClick={() => setSection("istatistik")}><BarChart3 size={16} aria-hidden="true"/>{t("İstatistikler")}</button>
    </nav>}
    {!editing && firm && section === "talepler" && <ContractorInbox approved={firm.status === "approved"} onSeen={seen}/>}
    {!editing && firm && section === "istatistik" && <FirmStatsPanel endpoint="/api/contractors/mine/stats" tiles={CONTRACTOR_TILES}/>}
    {!editing && firm && section === "profil" && <article className={`service-account-card status-${firm.status}`}>
      <div className="service-account-head">
        <span className="service-firm-logo">{firm.logo ? <img src={firm.logo} alt=""/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div><h3>{firm.name}</h3><span className={`service-status status-${firm.status}`}>{t(CONTRACTOR_STATUS_LABELS[firm.status])}</span>{firm.verified && <span className="service-status status-approved">{t("Doğrulanmış müteahhit")}</span>}</div>
      </div>
      {firm.reviewNote && firm.status !== "approved" && firm.status !== "pending" && <p className="service-review-note"><strong>{t("Yönetici notu")}:</strong> {firm.reviewNote}</p>}
      {firm.status === "pending" && <p className="project-editor-note">{t("Profiliniz inceleniyor. Onaylandığında Müteahhitler bölümünde yayınlanır.")}</p>}
      <p className="service-account-meta">{t("Son güncelleme")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(firm.updatedAt))} · {t("{n} bölge").replace("{n}", String(firm.areas.length))} · {t("{n} tamamlanan proje").replace("{n}", String(firm.projects.length))}</p>
      <div className="project-editor-actions">
        <Link className="outline-button" href={contractorPath(firm.id)} target="_blank" rel="noopener noreferrer">{t(firm.status === "approved" ? "Profili görüntüle" : "Önizle")}<ExternalLink size={15}/></Link>
        <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}><Pencil size={15}/>{t("Düzenle")}</button>
        <button type="button" className="outline-button danger" onClick={() => void remove()}><Trash2 size={15}/>{t("Sil")}</button>
      </div>
     
    </article>}
  </section>;
}

type MyRequest = LandRequest & { recipients: number; offers: LandOffer[] };

// Hesabım tab "Kat karşılığı taleplerim": the landowner's requests and offers, best share first.
export function LandRequestsPanel() {
  const { t, locale } = useLocale();
  const [requests, setRequests] = useState<MyRequest[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/contractors/land", { cache: "no-store" }), data = await apiJson<{ error?: string; requests?: MyRequest[] }>(response);
      if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi.");
      setRequests(data.requests || []); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(body: Record<string, string>, confirm?: string) {
    if (busy || (confirm && !window.confirm(t(confirm)))) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractors/land", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section className="service-account">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("MÜTEAHHİTLER")}</span><h2>{t("Kat karşılığı taleplerim")}</h2></div>
      <Link className="small-primary" href={LAND_PATH}>{t("Yeni talep")}<Plus size={17}/></Link></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {requests === null && !error && <p>{t("Yükleniyor...")}</p>}
    {requests && !requests.length && <div className="panel-empty"><HardHat size={26}/><p>{t("Henüz kat karşılığı talebiniz yok. Arsanızı bir kez anlatın, bölgenizdeki müteahhitler teklif versin.")}</p></div>}
    {requests?.map((request) => <article key={request.id} className="svc-inbox-item">
      <header><strong>{placeLabel(request)}</strong><span className={`service-status status-${request.status === "open" ? "approved" : "pending"}`}>{t(STATUS[request.status])}</span></header>
      <LandFacts request={request}/>
      <p className="service-account-meta">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(request.createdAt))} · {t("{n} müteahhide iletildi").replace("{n}", String(request.recipients))} · {t("{n} teklif").replace("{n}", String(request.offers.length))}</p>
      {request.offers.length > 0 ? <ul className="ctr-offers">{request.offers.map((offer) => <li key={offer.id} className={`ctr-offer state-${offer.state}`}>
        <div className="ctr-offer-head"><Link href={contractorPath(offer.firmId)} target="_blank" rel="noopener noreferrer"><strong>{offer.firmName}</strong></Link>{offer.firmVerified && <span className="service-verified">{t("Doğrulanmış müteahhit")}</span>}</div>
        <p className="ctr-offer-terms"><span>{t("Size kalacak pay")}: <strong>%{offer.ownerShare}</strong></span><span>{t("Teslim süresi")}: <strong>{t("{n} ay").replace("{n}", String(offer.deliveryMonths))}</strong></span></p>
        <p dir="auto">{offer.message}</p>
        {offer.state === "accepted" ? <p className="ctr-offer-sent"><CheckCircle2 size={16} aria-hidden="true"/>{t("Bu teklifi kabul ettiniz; iletişim bilgileriniz firmayla paylaşıldı.")}</p>
          : offer.state === "declined" ? <p className="service-account-meta">{t("Seçilmedi")}</p>
          : request.status === "open" && <button type="button" className="small-primary" disabled={busy} onClick={() => void act({ action: "accept", offerId: offer.id }, "Bu teklifi kabul etmek istiyor musunuz? Diğer teklifler reddedilir ve iletişim bilgileriniz bu firmayla paylaşılır.")}>{t("Teklifi kabul et")}</button>}
      </li>)}</ul> : request.status === "open" && <p className="project-editor-note">{t("Teklifler geldiğinde e-posta ile haber veririz.")}</p>}
      {request.status === "open" && <div className="project-editor-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => void act({ action: "close", requestId: request.id }, "Talep kapatılsın mı? Kapatılan talebe yeni teklif gelmez.")}>{t("Talebi kapat")}</button></div>}
      <p className="project-editor-note">{t("Anlaşmadan önce tapu, imar durumu ve yetki belgesini kontrol edin; sözleşmeyi noterde yapın.")}</p>
    </article>)}
  </section>;
}
