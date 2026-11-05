"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, Pencil, Plus, Store, Trash2, X } from "lucide-react";
import Link from "@/components/SafeLink";
import { apiJson } from "@/lib/api-client";
import { locales, useLocale } from "@/lib/i18n";
import { optimizeListingPhoto } from "@/lib/photo-optimize";
import { categoriesOf, SERVICE_GROUPS } from "@/lib/service-categories";
import { firmPath, SERVICE_LIMITS, SERVICE_STATUS_LABELS, SERVICE_TRANSLATION_LOCALES, type ServiceArea, type ServiceFirm } from "@/lib/services";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

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
  const prepared = await optimizeListingPhoto(file).catch(() => file);
  if (prepared.size > 8000000) throw new Error("JPG, PNG veya WEBP; en fazla 8 MB.");
  const body = new FormData(); body.append("file", prepared);
  const response = await fetch("/api/media?purpose=service", { method: "POST", body }), data = await apiJson<{ url?: string; error?: string }>(response);
  if (!response.ok || !data.url) throw new Error(data.error || "Fotoğraf yüklenemedi.");
  return data.url;
}

function FirmForm({ firm, onSaved, onCancel }: { firm: ServiceFirm | null; onSaved: (status: string) => void; onCancel: () => void }) {
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
    const list = kind === "photos" ? Array.from(files).slice(0, SERVICE_LIMITS.photos - latest.current.photos.length) : [files[0]];
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
        <label>{t("İl")}<select value={place.city} onChange={(event) => setPlace({ city: event.target.value, district: "" })}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        <label>{t("İlçe")}<select value={place.district} disabled={!place.city} onChange={(event) => setPlace((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm il")}</option>{districtsFor(place.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
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
      <span>{t("İş örnekleri")} <small>({form.photos.length}/{SERVICE_LIMITS.photos})</small></span>
      <div className="project-photo-grid">{form.photos.map((src) => <figure key={src}><img src={src} alt=""/><figcaption><button type="button" onClick={() => setForm((old) => ({ ...old, photos: old.photos.filter((value) => value !== src) }))} aria-label={t("Fotoğrafı kaldır")}><Trash2 size={14}/></button></figcaption></figure>)}</div>
      {form.photos.length < SERVICE_LIMITS.photos && <label className="outline-button project-upload"><ImagePlus size={16}/>{t(uploading === "photos" ? "Fotoğraflar yükleniyor..." : "Fotoğraf ekle")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={Boolean(uploading)} onChange={(event) => { void upload("photos", event.target.files); event.target.value = ""; }}/></label>}
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
export function ServiceFirmPanel() {
  const { t, locale } = useLocale();
  const [firm, setFirm] = useState<ServiceFirm | null | undefined>(undefined);
  const [editing, setEditing] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/services/mine", { cache: "no-store" });
      const data = await apiJson<{ error?: string; firm: ServiceFirm | null }>(response);
      if (!response.ok) throw new Error(data.error || "Firma bilgileri yüklenemedi.");
      setFirm(data.firm); setError("");
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
    {editing && firm !== undefined && <FirmForm firm={firm} onCancel={() => setEditing(false)} onSaved={(status) => { setEditing(false); setNotice(status === "approved" ? "Değişiklikler kaydedildi." : status === "suspended" ? "Değişiklikler kaydedildi. Profiliniz askıda olduğu için yayında değil." : "Firma profiliniz incelemeye gönderildi. Onaylandığında Hizmetler bölümünde yayınlanır."); void load(); }}/>}
    {!editing && firm === null && <div className="panel-empty service-account-intro"><Store size={28}/><h3>{t("Hizmet veriyorsanız firmanızı ekleyin")}</h3>
      <p>{t("Boyacı, tesisatçı, nakliyeci, avukat veya tercüman gibi hizmet veren firmalar Hizmetler bölümünde ücretsiz profil açabilir. Hesap türünüz değişmez; ilan vermeye devam edebilirsiniz.")}</p>
      <Link href="/hizmetler">{t("Hizmetler bölümünü görün")}<ExternalLink size={15}/></Link></div>}
    {!editing && firm && <article className={`service-account-card status-${firm.status}`}>
      <div className="service-account-head">
        <span className="service-firm-logo">{firm.logo ? <img src={firm.logo} alt=""/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div><h3>{firm.name}</h3><span className={`service-status status-${firm.status}`}>{t(SERVICE_STATUS_LABELS[firm.status])}</span>{firm.verified && <span className="service-status status-approved">{t("Doğrulanmış firma")}</span>}</div>
      </div>
      {firm.reviewNote && firm.status !== "approved" && firm.status !== "pending" && <p className="service-review-note"><strong>{t("Yönetici notu")}:</strong> {firm.reviewNote}</p>}
      {firm.status === "pending" && <p className="project-editor-note">{t("Profiliniz inceleniyor. Onaylandığında Hizmetler bölümünde yayınlanır.")}</p>}
      <p className="service-account-meta">{t("Son güncelleme")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(firm.updatedAt))} · {t("{n} kategori").replace("{n}", String(firm.categories.length))} · {t("{n} bölge").replace("{n}", String(firm.areas.length))}</p>
      <div className="project-editor-actions">
        <Link className="outline-button" href={firmPath(firm.id)} target="_blank" rel="noopener noreferrer">{t(firm.status === "approved" ? "Profili görüntüle" : "Önizle")}<ExternalLink size={15}/></Link>
        <button type="button" className="small-primary" onClick={() => { setEditing(true); setNotice(""); }}><Pencil size={15}/>{t("Düzenle")}</button>
        <button type="button" className="outline-button danger" onClick={() => void remove()}><Trash2 size={15}/>{t("Sil")}</button>
      </div>
    </article>}
  </section>;
}
