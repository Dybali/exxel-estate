"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, CalendarClock, ExternalLink, FileText, ImagePlus, Inbox, Pencil, Plus, Store, Trash2, X } from "lucide-react";
import Link from "@/components/SafeLink";
import { FeedbackCard } from "@/components/FeedbackWidget";
import { ServiceDetailsForm, ServiceDocuments, ServiceInbox, ServiceStatsPanel } from "@/components/ServiceFirmTools";
import { EMPTY_SERVICE_DETAILS, type ServiceDetails, type ServiceDocument } from "@/lib/service-extras";
import { apiJson } from "@/lib/api-client";
import { locales, useLocale } from "@/lib/i18n";
import { appendPhotoVariants, preparePhotoUpload } from "@/lib/photo-optimize";
import { categoriesOf, SERVICE_GROUPS } from "@/lib/service-categories";
import { firmPath, SERVICE_LIMITS, SERVICE_STATUS_LABELS, SERVICE_TRANSLATION_LOCALES, type ServiceArea, type ServiceFirm } from "@/lib/services";
import { areaDistricts as districtsFor } from "@/lib/service-locations";
import { CountryCitySelect } from "@/components/CountryCitySelect";

type Form = {
  name: string; description: string; translations: Record<string, string>; categories: string[]; areas: ServiceArea[]; phone: string; whatsapp: string; email: string; website: string;
  logo: string | null; cover: string | null; photos: string[]; taxOffice: string; taxNumber: string; terms: boolean;
};
const emptyForm = (): Form => ({ name: "", description: "", translations: {}, categories: [], areas: [], phone: "", whatsapp: "", email: "", website: "", logo: null, cover: null, photos: [], taxOffice: "", taxNumber: "", terms: false });
const formFrom = (firm: ServiceFirm): Form => ({
  name: firm.name, description: firm.description, translations: { ...firm.translations } as Record<string, string>, categories: [...firm.categories], areas: firm.areas.map((area) => ({ ...area })),
  phone: firm.phone, whatsapp: firm.whatsapp || "", email: firm.email || "", website: firm.website || "", logo: firm.logo, cover: firm.cover, photos: [...firm.photos],
  taxOffice: firm.taxOffice || "", taxNumber: firm.taxNumber || "", terms: true,
});

// Uploads one photo through the listing photo pipeline (resize in the browser, signature check and R2 on the server).
async function uploadPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 40000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
  const { file: prepared, variants } = await preparePhotoUpload(file);
  if (prepared.size > 8000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
  const body = new FormData(); body.append("file", prepared); appendPhotoVariants(body, variants);
  const response = await fetch("/api/media?purpose=service", { method: "POST", body }), data = await apiJson<{ url?: string; error?: string }>(response);
  if (!response.ok || !data.url) throw new Error(data.error || "Fotoğraf yüklenemedi.");
  return data.url;
}

// photoLimit: work photos the firm's package allows (lib/firm-plans.ts); the server checks it as well.
function FirmForm({ firm, onSaved, onCancel, photoLimit = 20 }: { firm: ServiceFirm | null; onSaved: (status: string) => void; onCancel: () => void; photoLimit?: number }) {
  const { t } = useLocale();
  const [form, setForm] = useState<Form>(firm ? formFrom(firm) : emptyForm());
  const [place, setPlace] = useState({ city: "", district: "" });
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(""), [error, setError] = useState("");
  const latest = useRef(form); latest.current = form;
  const set = (key: "name" | "description" | "phone" | "whatsapp" | "email" | "website" | "taxOffice" | "taxNumber") => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const toggleCategory = (slug: string, on: boolean) => setForm((old) => ({ ...old, categories: on ? [...old.categories, slug] : old.categories.filter((item) => item !== slug) }));
  function addArea() {
    if (!place.city) return;
    setForm((old) => {
      if (old.areas.some((area) => area.city === place.city && (area.district === place.district || !area.district))) return old;
      // Choosing the whole province replaces its single districts.
      const rest = place.district ? old.areas : old.areas.filter((area) => area.city !== place.city);
      return { ...old, areas: [...rest, { city: place.city, district: place.district }].slice(0, SERVICE_LIMITS.areas) };
    });
    setPlace((old) => ({ ...old, district: "" }));
  }
  async function upload(kind: "logo" | "cover" | "photos", files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(kind); setError("");
    const list = kind === "photos" ? Array.from(files).slice(0, Math.max(0, photoLimit - latest.current.photos.length)) : [files[0]];
    for (const file of list) {
      try {
        const url = await uploadPhoto(file);
        setForm((old) => kind === "photos" ? { ...old, photos: [...old.photos, url] } : { ...old, [kind]: url });
      } catch (cause) { setError((cause as Error).message); }
    }
    setUploading("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    if (!form.categories.length) { setError("En az bir, en fazla 8 hizmet kategorisi seçin."); return; }
    if (!form.areas.length) { setError("En az bir, en fazla 30 hizmet bölgesi seçin."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/services/mine", { method: firm ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await apiJson<{ error?: string; status?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Firma kaydedilemedi.");
      onSaved(data.status || "pending");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const language = (code: string) => locales.find((item) => item.code === code)?.label || code;
  const image = (kind: "logo" | "cover", label: string) => <div className={`service-upload service-upload-${kind}`}>
    <span>{t(label)}</span>
    {form[kind] ? <figure><img src={form[kind]!} alt=""/><button type="button" onClick={() => setForm((old) => ({ ...old, [kind]: null }))} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figure>
      : <label className="outline-button"><ImagePlus size={16}/>{t(uploading === kind ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(uploading)} onChange={(event) => { void upload(kind, event.target.files); event.target.value = ""; }}/></label>}
  </div>;
  return <form className="project-editor service-editor" onSubmit={submit}>
    <div className="project-editor-head"><h3>{t(firm ? "Firma profilini düzenle" : "Yeni hizmet firması")}</h3><button type="button" className="icon-button" onClick={onCancel} aria-label={t("Kapat")}><X size={18}/></button></div>
    <p className="project-editor-note">{t("Firma profilleri yönetici onayından sonra yayınlanır. Yaptığınız her değişiklik profili yeniden incelemeye gönderir.")}</p>
    <label>{t("Firma adı")}<input required minLength={SERVICE_LIMITS.nameMin} maxLength={SERVICE_LIMITS.nameMax} value={form.name} onChange={set("name")}/></label>
    <fieldset className="service-category-picker"><legend>{t("Hizmet kategorileri")} <small>({form.categories.length}/{SERVICE_LIMITS.categories})</small></legend>
      {SERVICE_GROUPS.map((group) => <div key={group.id}><strong>{t(group.name)}</strong>
        {categoriesOf(group.id).map((item) => { const checked = form.categories.includes(item.slug); return <label key={item.slug}><input type="checkbox" checked={checked} disabled={!checked && form.categories.length >= SERVICE_LIMITS.categories} onChange={(event) => toggleCategory(item.slug, event.target.checked)}/>{t(item.name)}</label>; })}
      </div>)}
    </fieldset>
    <fieldset className="service-area-picker"><legend>{t("Hizmet bölgeleri")} <small>({form.areas.length}/{SERVICE_LIMITS.areas})</small></legend>
      <p>{t("Tüm ili seçerseniz firmanız o ilin bütün ilçe sayfalarında da listelenir.")}</p>
      <div className="service-area-add">
        <label>{t("İl")}<CountryCitySelect value={place.city} onChange={(city) => setPlace({ city, district: "" })} placeholder={{ TR: "Seçin", DE: "Şehir seçin" }}/></label>
        <label>{t("İlçe")}<select value={place.district} disabled={!districtsFor(place.city).length} onChange={(event) => setPlace((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm il")}</option>{districtsFor(place.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
        <button type="button" className="outline-button" disabled={!place.city || form.areas.length >= SERVICE_LIMITS.areas} onClick={addArea}><Plus size={16}/>{t("Bölge ekle")}</button>
      </div>
      {form.areas.length > 0 && <ul className="service-area-chips">{form.areas.map((area) => <li key={`${area.city}|${area.district}`}>{area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`}<button type="button" onClick={() => setForm((old) => ({ ...old, areas: old.areas.filter((item) => item !== area) }))} aria-label={t("Bölgeyi kaldır")}><X size={13}/></button></li>)}</ul>}
    </fieldset>
    <label>{t("Firma açıklaması")}<textarea required minLength={SERVICE_LIMITS.descriptionMin} maxLength={SERVICE_LIMITS.descriptionMax} rows={6} value={form.description} onChange={set("description")} placeholder={t("Hangi işleri yaptığınızı, deneyiminizi ve çalışma saatlerinizi yazın.")}/></label>
    <details className="service-translations"><summary>{t("Açıklamanın diğer dillerdeki çevirileri (isteğe bağlı)")}</summary>
      <p>{t("Yabancı müşteriler profilinizi kendi dillerinde görür. Boş bıraktığınız dillerde yukarıdaki açıklama gösterilir.")}</p>
      {SERVICE_TRANSLATION_LOCALES.map((code) => <label key={code} lang={code}>{language(code)}<textarea rows={3} maxLength={SERVICE_LIMITS.descriptionMax} dir={code === "ar" || code === "fa" ? "rtl" : "ltr"} value={form.translations[code] || ""} onChange={(event) => setForm((old) => ({ ...old, translations: { ...old.translations, [code]: event.target.value } }))}/></label>)}
    </details>
    <div className="project-editor-grid">
      <label>{t("Firma telefonu")}<input required type="tel" inputMode="tel" maxLength={25} placeholder="0532 123 45 67" value={form.phone} onChange={set("phone")}/></label>
      <label>{t("WhatsApp numarası (isteğe bağlı)")}<input type="tel" inputMode="tel" maxLength={25} value={form.whatsapp} onChange={set("whatsapp")}/></label>
      <label>{t("Firma e-postası (isteğe bağlı)")}<input type="email" maxLength={254} value={form.email} onChange={set("email")}/></label>
      <label>{t("Web sitesi (isteğe bağlı)")}<input type="url" maxLength={300} placeholder="https://" value={form.website} onChange={set("website")}/></label>
    </div>
    <p className="project-editor-note">{t("Telefon, WhatsApp, e-posta ve web sitesi onaydan sonra profilinizde herkese açık gösterilir.")}</p>
    <fieldset className="project-photos service-photo-editor"><legend>{t("Logo ve fotoğraflar")}</legend>
      <div className="service-upload-row">{image("logo", "Logo")}{image("cover", "Kapak fotoğrafı")}</div>
      <span>{t("İş örnekleri")} <small>({form.photos.length}/{photoLimit})</small></span>
      <div className="project-photo-grid">{form.photos.map((src) => <figure key={src}><img src={src} alt=""/><figcaption><button type="button" onClick={() => setForm((old) => ({ ...old, photos: old.photos.filter((value) => value !== src) }))} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figcaption></figure>)}</div>
      {form.photos.length < photoLimit && <label className="outline-button project-upload"><ImagePlus size={16}/>{t(uploading === "photos" ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={Boolean(uploading)} onChange={(event) => { void upload("photos", event.target.files); event.target.value = ""; }}/></label>}
    </fieldset>
    <fieldset className="service-tax"><legend>{t("Vergi bilgileri (isteğe bağlı)")}</legend>
      <p>{t("Yalnızca yöneticiler görür; doğrulanmış firma rozeti için kullanılır.")}</p>
      <div className="project-editor-grid">
        <label>{t("Vergi dairesi")}<input maxLength={80} value={form.taxOffice} onChange={set("taxOffice")}/></label>
        <label>{t("Vergi numarası veya T.C. kimlik numarası")}<input inputMode="numeric" pattern="\d{10,11}" maxLength={11} value={form.taxNumber} onChange={set("taxNumber")}/></label>
      </div>
    </fieldset>
    {!firm && <label className="service-terms"><input type="checkbox" required checked={form.terms} onChange={(event) => setForm((old) => ({ ...old, terms: event.target.checked }))}/>{t("Bilgilerin doğru olduğunu ve firma profilimin iletişim bilgileriyle birlikte herkese açık yayınlanmasını onaylıyorum.")}</label>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="project-editor-actions"><button type="submit" className="small-primary" disabled={busy || Boolean(uploading)}>{t(busy ? "Kaydediliyor..." : firm ? "Değişiklikleri kaydet" : "Onaya gönder")}</button><button type="button" className="outline-button" onClick={onCancel}>{t("Vazgeç")}</button></div>
  </form>;
}

// Hesabım tab "Hizmet firmam": one service firm per member, independent of the account role.
const SECTIONS = [
  { id: "profil", label: "Profil", icon: Store }, { id: "talepler", label: "Teklif talepleri", icon: Inbox }, { id: "calisma", label: "Çalışma bilgileri", icon: CalendarClock },
  { id: "belgeler", label: "Belgeler", icon: FileText }, { id: "istatistik", label: "İstatistikler", icon: BarChart3 },
] as const;
type Section = typeof SECTIONS[number]["id"];
type Extras = { details: ServiceDetails; documents: ServiceDocument[]; unseen: number; responseHours: number | null };
type Plan = { limits: { photos: number; statsDays: number } };

export function ServiceFirmPanel() {
  const { t, locale } = useLocale();
  const [firm, setFirm] = useState<ServiceFirm | null | undefined>(undefined);
  const [extras, setExtras] = useState<Extras>({ details: EMPTY_SERVICE_DETAILS, documents: [], unseen: 0, responseHours: null }), [plan, setPlan] = useState<Plan | null>(null);
  // ?bolum=talepler (links in the quote e-mails) opens a section directly.
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "profil";
    const wanted = new URLSearchParams(window.location.search).get("bolum");
    return SECTIONS.some((item) => item.id === wanted) ? wanted as Section : "profil";
  });
  const choose = (next: Section) => {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "profil") url.searchParams.delete("bolum"); else url.searchParams.set("bolum", next);
    window.history.replaceState(null, "", url);
  };
  const seen = useCallback(() => setExtras((old) => ({ ...old, unseen: 0 })), []);
  const [editing, setEditing] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/services/mine", { cache: "no-store" });
      const data = await apiJson<{ error?: string; firm: ServiceFirm | null; plan?: Plan } & Partial<Extras>>(response);
      if (!response.ok) throw new Error(data.error || "Firma bilgileri yüklenemedi.");
      setFirm(data.firm); setPlan(data.plan || null); setError("");
      if (data.firm) setExtras({ details: data.details || EMPTY_SERVICE_DETAILS, documents: data.documents || [], unseen: data.unseen || 0, responseHours: data.responseHours ?? null });
    } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove() {
    if (!window.confirm(t("Firma profiliniz ve fotoğrafları kalıcı olarak silinsin mi?"))) return;
    setNotice("");
    try {
      const response = await fetch("/api/services/mine", { method: "DELETE" });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Firma silinemedi.");
      setFirm(null); setNotice("Firma profiliniz silindi.");
    } catch (cause) { setError((cause as Error).message); }
  }
  return <section className="service-account">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("HİZMETLER")}</span><h2>{t("Hizmet firmam")}</h2></div>
      {firm === null && !editing && <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}>{t("Firma profili oluştur")}<Plus size={17}/></button>}</div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {notice && <p className="profile-save-success" role="status">{t(notice)}</p>}
    {firm === undefined && !error && <p>{t("Yükleniyor...")}</p>}
    {editing && firm !== undefined && <FirmForm firm={firm} photoLimit={plan?.limits.photos} onCancel={() => setEditing(false)} onSaved={(status) => { setEditing(false); setNotice(status === "approved" ? "Değişiklikler kaydedildi." : status === "suspended" ? "Değişiklikler kaydedildi. Profiliniz askıda olduğu için yayında değil." : "Firma profiliniz incelemeye gönderildi. Onaylandığında Hizmetler bölümünde yayınlanır."); void load(); }}/>}
    {!editing && firm === null && <div className="panel-empty service-account-intro"><Store size={28}/><h3>{t("Firma profilinizi oluşturun")}</h3>
      <p>{t("Profilinizi doldurup onaya gönderin. Yönetici onayından sonra Hizmetler bölümünde yayınlanır ve bölgenizdeki teklif talepleri size gelir.")}</p>
      <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}>{t("Firma profili oluştur")}<Plus size={17}/></button>
      <Link href="/hizmetler">{t("Hizmetler bölümünü görün")}<ExternalLink size={15}/></Link></div>}
    {!editing && firm && <nav className="svc-panel-tabs" aria-label={t("Firma paneli")}>{SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={section === id} onClick={() => choose(id)}>
      <Icon size={16} aria-hidden="true"/>{t(label)}{id === "talepler" && extras.unseen > 0 && <b className="svc-tab-count" aria-label={t("{n} yeni").replace("{n}", String(extras.unseen))}>{extras.unseen}</b>}</button>)}</nav>}
    {!editing && firm && section === "talepler" && <ServiceInbox approved={firm.status === "approved"} onSeen={seen} firmId={firm.id}/>}
    {!editing && firm && section === "calisma" && <ServiceDetailsForm initial={extras.details} onSaved={(details) => setExtras((old) => ({ ...old, details }))}/>}
    {!editing && firm && section === "belgeler" && <ServiceDocuments initial={extras.documents} onChanged={(documents) => setExtras((old) => ({ ...old, documents }))}/>}
    {!editing && firm && section === "istatistik" && <ServiceStatsPanel maxDays={plan?.limits.statsDays}/>}
    {!editing && firm && section === "profil" && <article className={`service-account-card status-${firm.status}`}>
      <div className="service-account-head">
        <span className="service-firm-logo">{firm.logo ? <img src={firm.logo} alt=""/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div><h3>{firm.name}</h3><span className={`service-status status-${firm.status}`}>{t(SERVICE_STATUS_LABELS[firm.status])}</span>{firm.verified && <span className="service-status status-approved">{t("Doğrulanmış firma")}</span>}{firm.documented && <span className="service-status status-approved">{t("Belgeli firma")}</span>}</div>
      </div>
      {firm.reviewNote && firm.status !== "approved" && firm.status !== "pending" && <p className="service-review-note"><strong>{t("Yönetici notu")}:</strong> {firm.reviewNote}</p>}
      {firm.status === "pending" && <p className="project-editor-note">{t("Profiliniz inceleniyor. Onaylandığında Hizmetler bölümünde yayınlanır.")}</p>}
      {extras.responseHours !== null && <p className="service-account-meta">{t("Ortalama yanıt süreniz: {n} saat").replace("{n}", String(extras.responseHours))}</p>}
      <p className="service-account-meta">{t("Son güncelleme")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(firm.updatedAt))} · {t("{n} kategori").replace("{n}", String(firm.categories.length))} · {t("{n} bölge").replace("{n}", String(firm.areas.length))}</p>
      <div className="project-editor-actions">
        <Link className="outline-button" href={firmPath(firm.id)} target="_blank" rel="noopener noreferrer">{t(firm.status === "approved" ? "Profili görüntüle" : "Önizle")}<ExternalLink size={15}/></Link>
        <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}><Pencil size={15}/>{t("Düzenle")}</button>
        <button type="button" className="outline-button danger" onClick={() => void remove()}><Trash2 size={15}/>{t("Sil")}</button>
      </div>
    </article>}
    {!editing && firm && section === "profil" && <FeedbackCard/>}
  </section>;
}
