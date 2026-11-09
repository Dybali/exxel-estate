"use client";
// Owner tools of "Hizmet firmam" (components/ServiceFirmPanel.tsx), phase 2 (lib/service-extras.ts):
// working information, documents, received quote requests with offers, and profile statistics.
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, Download, Eye, FileText, Globe, Inbox, Mail, MessageCircle, Phone, Send, Siren, Trash2, Upload } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { serviceCategory } from "@/lib/service-categories";
import {
  EMPTY_SERVICE_DETAILS, QUOTE_LIMITS, QUOTE_RECIPIENT_LABELS, QUOTE_STATUS_LABELS, QUOTE_TIMINGS, SERVICE_DOCUMENT_KINDS, SERVICE_DOCUMENT_LIMIT, SERVICE_DOCUMENT_STATES,
  SERVICE_PRICE_UNITS, SERVICE_WEEKDAYS, type FirmInboxItem, type ServiceDayHours, type ServiceDetails, type ServiceDocument, type ServiceDocumentKind, type ServicePriceUnit, type ServiceStats,
} from "@/lib/service-extras";

async function call<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await apiJson<T & { error?: string }>(response);
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const useTry = () => {
  const { locale } = useLocale();
  return (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
};

// --- Working information ------------------------------------------------------------------------
const WEEKDAY_DEFAULT: ServiceDayHours[] = [["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["10:00", "16:00"], null];

export function ServiceDetailsForm({ initial, onSaved }: { initial: ServiceDetails; onSaved: (details: ServiceDetails) => void }) {
  const { t } = useLocale();
  const [form, setForm] = useState<ServiceDetails>(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const hoursOn = form.hours.length === 7;
  const setDay = (index: number, value: ServiceDayHours) => setForm((old) => ({ ...old, hours: old.hours.map((day, at) => at === index ? value : day) }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const data = await call<{ details: ServiceDetails }>("/api/services/mine/details", json("PATCH", form));
      setForm(data.details); setSaved(true); onSaved(data.details);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <form className="svc-tool-card svc-details-form" onSubmit={submit}>
    <div className="svc-tool-head"><CalendarClock size={20} aria-hidden="true"/><div><h3>{t("Çalışma bilgileri")}</h3><p>{t("Bu bilgiler profilinizde hemen görünür; yeniden onaya gönderilmez.")}</p></div></div>
    <label className="svc-switch"><input type="checkbox" checked={form.emergency} onChange={(event) => setForm((old) => ({ ...old, emergency: event.target.checked }))}/><span><Siren size={16} aria-hidden="true"/>{t("7/24 acil hizmet veriyorum")}</span></label>
    <fieldset className="svc-hours"><legend>{t("Çalışma saatleri")}</legend>
      <label className="svc-switch"><input type="checkbox" checked={hoursOn} onChange={(event) => setForm((old) => ({ ...old, hours: event.target.checked ? WEEKDAY_DEFAULT.map((day) => day && [...day] as ServiceDayHours) : [] }))}/><span>{t("Çalışma saatlerini profilimde göster")}</span></label>
      {hoursOn && <div className="svc-hours-grid">{SERVICE_WEEKDAYS.map((name, index) => {
        const day = form.hours[index];
        return <div key={name} className={day ? "svc-hours-row" : "svc-hours-row closed"}>
          <label className="svc-day"><input type="checkbox" checked={Boolean(day)} onChange={(event) => setDay(index, event.target.checked ? ["09:00", "18:00"] : null)}/>{t(name)}</label>
          {day ? <>
            <input type="time" aria-label={`${t(name)} · ${t("Açılış")}`} value={day[0]} step={900} onChange={(event) => setDay(index, [event.target.value, day[1]])}/>
            <span aria-hidden="true">–</span>
            <input type="time" aria-label={`${t(name)} · ${t("Kapanış")}`} value={day[1] === "24:00" ? "23:59" : day[1]} step={900} onChange={(event) => setDay(index, [day[0], event.target.value === "23:59" ? "24:00" : event.target.value])}/>
          </> : <span className="svc-closed">{t("Kapalı")}</span>}
        </div>;
      })}</div>}
    </fieldset>
    <fieldset className="svc-price"><legend>{t("Fiyat aralığı (isteğe bağlı)")}</legend>
      <p>{t("Müşteriye fikir vermek için ortalama fiyatınızı TL olarak yazın. Kesin fiyat teklif ile verilir.")}</p>
      <div className="svc-price-row">
        <label>{t("En düşük (TL)")}<input inputMode="numeric" value={form.priceMin ?? ""} onChange={(event) => setForm((old) => ({ ...old, priceMin: event.target.value.replace(/\D/g, "") ? Number(event.target.value.replace(/\D/g, "")) : null }))}/></label>
        <label>{t("En yüksek (TL)")}<input inputMode="numeric" value={form.priceMax ?? ""} onChange={(event) => setForm((old) => ({ ...old, priceMax: event.target.value.replace(/\D/g, "") ? Number(event.target.value.replace(/\D/g, "")) : null }))}/></label>
        <label>{t("Birim")}<select value={form.priceUnit} onChange={(event) => setForm((old) => ({ ...old, priceUnit: event.target.value as ServicePriceUnit }))}>{Object.entries(SERVICE_PRICE_UNITS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
      </div>
      <label>{t("Fiyat notu")}<input maxLength={200} value={form.priceNote} placeholder={t("Örn. malzeme hariç, keşif ücretsiz")} onChange={(event) => setForm((old) => ({ ...old, priceNote: event.target.value }))}/></label>
    </fieldset>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {saved && <p className="profile-save-success" role="status">{t("Çalışma bilgileri kaydedildi.")}</p>}
    <div className="project-editor-actions"><button type="submit" className="small-primary" disabled={busy}>{t(busy ? "Kaydediliyor..." : "Kaydet")}</button></div>
  </form>;
}

// --- Documents ----------------------------------------------------------------------------------
export function ServiceDocuments({ initial, onChanged }: { initial: ServiceDocument[]; onChanged: (documents: ServiceDocument[]) => void }) {
  const { t, locale } = useLocale();
  const [documents, setDocuments] = useState(initial), [kind, setKind] = useState<ServiceDocumentKind>("tax");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = (next: ServiceDocument[]) => { setDocuments(next); onChanged(next); };
  async function upload(file: File | undefined) {
    if (!file || busy) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { setError("Geçerli PDF, JPG veya PNG dosyası yükleyin."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Belge en fazla 5 MB olabilir."); return; }
    setBusy(true); setError("");
    try {
      const data = await call<{ document: ServiceDocument }>("/api/services/mine/documents", { method: "POST", headers: { "Content-Type": file.type, "X-Document-Kind": kind }, body: file });
      update([data.document, ...documents]);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm(t("Belge kalıcı olarak silinsin mi?"))) return;
    try { await call("/api/services/mine/documents?id=" + id, { method: "DELETE" }); update(documents.filter((item) => item.id !== id)); }
    catch (cause) { setError((cause as Error).message); }
  }
  const approved = documents.some((item) => item.state === "approved");
  return <section className="svc-tool-card">
    <div className="svc-tool-head"><FileText size={20} aria-hidden="true"/><div><h3>{t("Belgeler")}</h3><p>{t("Vergi levhası, ustalık belgesi veya sigorta poliçenizi yükleyin. Belgeleri yalnızca yöneticiler görür; onaylanan bir belge profilinize \"Belgeli firma\" rozeti ekler.")}</p></div></div>
    {approved && <p className="svc-doc-badge"><BadgeCheck size={17} aria-hidden="true"/>{t("Profilinizde \"Belgeli firma\" rozeti görünüyor.")}</p>}
    {documents.length < SERVICE_DOCUMENT_LIMIT && <div className="svc-doc-upload">
      <label>{t("Belge türü")}<select value={kind} onChange={(event) => setKind(event.target.value as ServiceDocumentKind)}>{Object.entries(SERVICE_DOCUMENT_KINDS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
      <label className="outline-button"><Upload size={16} aria-hidden="true"/>{t(busy ? "Yükleniyor..." : "Dosya seç ve yükle")}<input type="file" accept="application/pdf,image/jpeg,image/png" hidden disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }}/></label>
      <small>{t("PDF, JPG veya PNG; en fazla 5 MB.")}</small>
    </div>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {documents.length > 0 && <ul className="svc-doc-list">{documents.map((item) => <li key={item.id} className={`state-${item.state}`}>
      <FileText size={18} aria-hidden="true"/>
      <div><strong>{t(SERVICE_DOCUMENT_KINDS[item.kind])}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.createdAt))} · {Math.max(1, Math.round(item.size / 1024))} KB</small>
        {item.state === "rejected" && item.note && <small className="svc-doc-note">{t("Yönetici notu")}: {item.note}</small>}</div>
      <span className={`service-status status-${item.state === "approved" ? "approved" : item.state === "rejected" ? "rejected" : "pending"}`}>{t(SERVICE_DOCUMENT_STATES[item.state])}</span>
      <a className="icon-button" href={`/api/services/documents/${item.id}`} aria-label={t("Belgeyi indir")}><Download size={16}/></a>
      <button type="button" className="icon-button" onClick={() => void remove(item.id)} aria-label={t("Belgeyi sil")}><Trash2 size={16}/></button>
    </li>)}</ul>}
  </section>;
}

// --- Received quote requests ----------------------------------------------------------------------
function OfferForm({ item, onSent }: { item: FirmInboxItem; onSent: () => void }) {
  const { t } = useLocale();
  const [form, setForm] = useState({ priceMin: "", priceMax: "", message: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await call("/api/services/mine/quotes", json("POST", { requestId: item.requestId, priceMin: Number(form.priceMin), priceMax: form.priceMax ? Number(form.priceMax) : null, message: form.message }));
      onSent();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 9);
  return <form className="svc-offer-form" onSubmit={submit}>
    <div className="svc-price-row">
      <label>{t("Teklif tutarı (TL)")}<input required inputMode="numeric" value={form.priceMin} onChange={(event) => setForm((old) => ({ ...old, priceMin: digits(event.target.value) }))}/></label>
      <label>{t("En fazla (TL, isteğe bağlı)")}<input inputMode="numeric" value={form.priceMax} onChange={(event) => setForm((old) => ({ ...old, priceMax: digits(event.target.value) }))}/></label>
    </div>
    <label>{t("Teklif açıklaması")}<textarea required rows={3} minLength={QUOTE_LIMITS.messageMin} maxLength={QUOTE_LIMITS.messageMax} value={form.message} placeholder={t("Neler dahil, ne zaman başlayabilirsiniz, keşif gerekiyor mu?")} onChange={(event) => setForm((old) => ({ ...old, message: event.target.value }))}/></label>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <button type="submit" className="small-primary" disabled={busy}><Send size={15} aria-hidden="true"/>{t(busy ? "Gönderiliyor..." : "Teklifi gönder")}</button>
  </form>;
}

export function ServiceInbox({ approved, onSeen }: { approved: boolean; onSeen: () => void }) {
  const { t, locale } = useLocale(), money = useTry();
  const [items, setItems] = useState<FirmInboxItem[] | null>(null), [error, setError] = useState(""), [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const data = await call<{ requests: FirmInboxItem[] }>("/api/services/mine/quotes"); setItems(data.requests); setError(""); onSeen(); }
    catch (cause) { setError((cause as Error).message); }
  }, [onSeen]);
  useEffect(() => { void load(); }, [load]);
  async function decline(requestId: string) {
    try { await call("/api/services/mine/quotes", json("PATCH", { requestId, action: "decline" })); await load(); }
    catch (cause) { setError((cause as Error).message); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className="svc-tool-card">
    <div className="svc-tool-head"><Inbox size={20} aria-hidden="true"/><div><h3>{t("Gelen teklif talepleri")}</h3><p>{t("Bölgenizdeki müşteriler işlerini anlatır; siz fiyat teklifinizi buradan gönderirsiniz. Hızlı yanıt veren firmalar daha çok iş alır.")}</p></div></div>
    {!approved && <p className="project-editor-note">{t("Firmanız yayına alındığında teklif talepleri burada görünür.")}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!items && !error && <p>{t("Yükleniyor...")}</p>}
    {items && !items.length && <p className="svc-empty">{t("Henüz teklif talebi yok.")}</p>}
    {items && items.length > 0 && <ul className="svc-inbox">{items.map((item) => {
      const category = serviceCategory(item.category), place = item.district ? `${item.district}, ${item.city}` : item.city;
      const canOffer = approved && item.status === "open" && !item.offer && item.state !== "declined";
      return <li key={item.requestId} className={`svc-inbox-item state-${item.state}`}>
        <div className="svc-inbox-top">
          <strong>{category ? t(category.name) : item.category} · {place}</strong>
          <span className={`service-status status-${item.status === "open" ? "approved" : "pending"}`}>{t(item.state === "new" ? QUOTE_RECIPIENT_LABELS.new : item.status === "open" ? QUOTE_RECIPIENT_LABELS[item.state] : QUOTE_STATUS_LABELS[item.status])}</span>
        </div>
        <p className="svc-inbox-meta">{item.name} · {t(QUOTE_TIMINGS[item.timing])} · {date(item.createdAt)}{item.direct ? ` · ${t("Doğrudan size gönderildi")}` : ""}</p>
        <p className="svc-inbox-text" dir="auto">{item.description}</p>
        {(item.phone || item.email) && <p className="svc-inbox-contact">{item.phone && <a href={`tel:${item.phone}`}><Phone size={14} aria-hidden="true"/><bdi>{item.phone}</bdi></a>}{item.email && <a href={`mailto:${item.email}`}><Mail size={14} aria-hidden="true"/>{item.email}</a>}</p>}
        {item.offer ? <p className="svc-inbox-offer"><Send size={14} aria-hidden="true"/>{t("Teklifiniz")}: <strong>{money(item.offer.priceMin)}{item.offer.priceMax ? ` – ${money(item.offer.priceMax)}` : ""}</strong>{item.offer.state === "accepted" ? ` · ${t("Kabul edildi")}` : item.offer.state === "rejected" ? ` · ${t("Başka teklif seçildi")}` : ""}</p>
          : canOffer && (open === item.requestId ? <OfferForm item={item} onSent={() => { setOpen(null); void load(); }}/>
            : <div className="project-editor-actions"><button type="button" className="small-primary" onClick={() => setOpen(item.requestId)}><Send size={15} aria-hidden="true"/>{t("Teklif ver")}</button><button type="button" className="outline-button" onClick={() => void decline(item.requestId)}>{t("Geç")}</button></div>)}
      </li>;
    })}</ul>}
  </section>;
}

// --- Statistics -----------------------------------------------------------------------------------
export function ServiceStatsPanel() {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [days, setDays] = useState(30), [stats, setStats] = useState<ServiceStats | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    call<{ stats: ServiceStats }>(`/api/services/mine/stats?gun=${days}`).then((data) => { if (active) { setStats(data.stats); setError(""); } }).catch((cause) => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [days]);
  const tiles = stats ? [
    { kind: "view", label: "Profil görüntülenme", icon: Eye }, { kind: "phone", label: "Telefon tıklaması", icon: Phone }, { kind: "whatsapp", label: "WhatsApp tıklaması", icon: MessageCircle },
    { kind: "email", label: "E-posta tıklaması", icon: Mail }, { kind: "website", label: "Web sitesi tıklaması", icon: Globe }, { kind: "quote", label: "Gelen teklif talebi", icon: Inbox }, { kind: "offer", label: "Gönderilen teklif", icon: Send },
  ] as const : [];
  const peak = stats ? Math.max(1, ...stats.daily.map((item) => item.views + item.contacts)) : 1;
  return <section className="svc-tool-card">
    <div className="svc-tool-head"><Eye size={20} aria-hidden="true"/><div><h3>{t("İstatistikler")}</h3><p>{t("Profilinizin kaç kez görüntülendiği ve müşterilerin sizinle nasıl iletişime geçtiği. Ziyaretçilerin kimliği saklanmaz.")}</p></div>
      <div className="admin-tabs svc-range">{[7, 30, 90].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{t("{n} gün").replace("{n}", String(value))}</button>)}</div></div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!stats && !error && <p>{t("Yükleniyor...")}</p>}
    {stats && <>
      <dl className="svc-stat-grid">{tiles.map(({ kind, label, icon: Icon }) => {
        const now = stats.totals[kind], before = stats.previous[kind], change = before ? Math.round((now - before) / before * 100) : null;
        return <div key={kind}><dt><Icon size={15} aria-hidden="true"/>{t(label)}</dt><dd>{number(now)}</dd>{change !== null && <small className={change >= 0 ? "up" : "down"}>{change >= 0 ? "+" : ""}{change}% {t("önceki döneme göre")}</small>}</div>;
      })}</dl>
      <figure className="svc-chart">
        <figcaption>{t("Günlük görüntülenme ve iletişim tıklamaları")}</figcaption>
        <div className="svc-chart-bars" role="img" aria-label={t("Günlük görüntülenme ve iletişim tıklamaları")}>{stats.daily.map((item) => <span key={item.day} title={`${item.day}: ${item.views} / ${item.contacts}`}>
          <i className="views" style={{ height: `${(item.views / peak) * 100}%` }}/><i className="contacts" style={{ height: `${(item.contacts / peak) * 100}%` }}/>
        </span>)}</div>
        <p className="svc-chart-legend"><span className="views">{t("Görüntülenme")}</span><span className="contacts">{t("İletişim tıklaması")}</span></p>
      </figure>
    </>}
  </section>;
}

export const EMPTY_DETAILS = EMPTY_SERVICE_DETAILS;
