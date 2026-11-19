"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, ClipboardList, Home, MapPin, MessageCircle, Search, ShieldCheck, Users, Wallet } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { loadAccount } from "@/lib/account-client";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/lib/listings";
import { HOME_CONTACT, HOME_CONTACT_TIMES, HOME_FEATURES, HOME_PAYMENTS, HOME_REQUEST_LIMITS, HOME_ROOMS, HOME_TIMELINES, HOME_TYPES } from "@/lib/home-requests";

// /benim-icin-bul: the member describes the home in four steps; the request goes to the open board of approved
// estate agents (lib/lead-board.ts), at most 4 of them can reach the member, and the member sees listings that
// already match (lib/home-requests.ts, docs/buyer-tools.md).
const CATEGORY_LABELS = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" } as const;
const STEPS = [
  { title: "Ne arıyorsunuz?", icon: Home },
  { title: "Nerede?", icon: MapPin },
  { title: "Bütçe ve zamanlama", icon: Wallet },
  { title: "İletişim", icon: MessageCircle },
] as const;
type Form = {
  intent: "buy" | "rent"; category: keyof typeof CATEGORY_LABELS; types: string[]; roomsList: string[]; minArea: string;
  city: string; districts: string[]; features: string[];
  budgetMin: string; budgetMax: string; timeline: string; payment: string; foreign: boolean; citizenship: boolean;
  note: string; name: string; email: string; phone: string; contact: keyof typeof HOME_CONTACT; contactTime: keyof typeof HOME_CONTACT_TIMES; alert: boolean; consent: boolean;
};
const digits = (value: string) => value.replace(/\D/g, "");

function Chips({ options, selected, onToggle, max, label }: { options: readonly { value: string; label: string }[]; selected: string[]; onToggle: (value: string) => void; max?: number; label: string }) {
  const { t } = useLocale();
  return <div className="request-chips" role="group" aria-label={label}>{options.map((option) => {
    const on = selected.includes(option.value), full = !on && max != null && selected.length >= max;
    return <button key={option.value} type="button" className={on ? "active" : ""} aria-pressed={on} disabled={full} onClick={() => onToggle(option.value)}>{t(option.label)}</button>;
  })}</div>;
}

export function HomeRequestForm() {
  const { t, locale } = useLocale();
  const [account, setAccount] = useState<{ name?: string; email?: string; phone?: string | null } | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ intent: "buy", category: "konut", types: [], roomsList: [], minArea: "", city: "", districts: [], features: [], budgetMin: "", budgetMax: "", timeline: "", payment: "", foreign: false, citizenship: false, note: "", name: "", email: "", phone: "", contact: "phone", contactTime: "any", alert: true, consent: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [done, setDone] = useState<{ search: string; alert: boolean } | null>(null);
  const [matches, setMatches] = useState<{ listings: Listing[]; total: number } | null>(null);
  useEffect(() => {
    loadAccount().then((data) => {
      const user = data.user as { name?: string; email?: string; phone?: string | null } | null | undefined;
      setAccount(user || null);
      if (user) setForm((old) => ({ ...old, name: user.name || "", email: user.email || "", phone: user.phone || "", contact: user.phone ? "phone" : "email" }));
    }).catch(() => setAccount(null));
  }, []);
  useEffect(() => {
    if (!done) return;
    fetch(`/api/listings?${done.search}`).then((response) => response.ok ? response.json() as Promise<{ listings?: Listing[]; total?: number }> : null)
      .then((data) => setMatches({ listings: (data?.listings || []).slice(0, 4), total: data?.total || 0 })).catch(() => setMatches({ listings: [], total: 0 }));
  }, [done]);
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value }));
  const toggle = (key: "types" | "roomsList" | "districts" | "features", value: string) => setForm((old) => ({ ...old, [key]: old[key].includes(value) ? old[key].filter((item) => item !== value) : [...old[key], value] }));
  const money = (value: string) => value ? new Intl.NumberFormat(locale).format(Number(digits(value))) : "";
  const budgetError = form.budgetMin && form.budgetMax && Number(digits(form.budgetMin)) > Number(digits(form.budgetMax));
  const stepError = useMemo(() => {
    if (step === 1 && !form.city) return "İl seçin.";
    if (step === 2 && budgetError) return "En düşük bütçe en yüksek bütçeden büyük olamaz.";
    return "";
  }, [step, form.city, budgetError]);
  const next = () => { if (stepError) { setError(stepError); return; } setError(""); setStep((value) => Math.min(value + 1, STEPS.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const back = () => { setError(""); setStep((value) => Math.max(value - 1, 0)); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) { next(); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, budgetMin: digits(form.budgetMin), budgetMax: digits(form.budgetMax), minArea: digits(form.minArea), language: locale }) });
      const data = await apiJson<{ search?: string; alert?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Talep gönderilemedi.");
      setDone({ search: data.search || "", alert: Boolean(data.alert) }); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  const loginNext = encodeURIComponent("/benim-icin-bul");
  const buy = form.intent === "buy";
  const typeLabels = form.types.map((value) => t(HOME_TYPES[form.category].find((item) => item.value === value)?.label || value));
  const summaryRows: [string, string][] = [
    ["Ne arıyorsunuz?", [t(buy ? "Satın almak istiyorum" : "Kiralamak istiyorum"), t(CATEGORY_LABELS[form.category]), typeLabels.join(", "), form.roomsList.map((item) => t(item)).join(", "), form.minArea ? `${t("en az")} ${money(form.minArea)} m²` : ""].filter(Boolean).join(" · ")],
    ["Nerede?", [form.districts.join(", "), form.city].filter(Boolean).join(", ")],
    ["Olmazsa olmazlar", form.features.map((item) => t(item)).join(", ")],
    ["Bütçe", form.budgetMin || form.budgetMax ? `${form.budgetMin ? `₺${money(form.budgetMin)}` : "…"} – ${form.budgetMax ? `₺${money(form.budgetMax)}` : "…"}${buy ? "" : ` ${t("/ ay")}`}` : ""],
    ["Zamanlama", [form.timeline ? t(HOME_TIMELINES[form.timeline as keyof typeof HOME_TIMELINES]) : "", form.payment ? t(HOME_PAYMENTS[form.payment as keyof typeof HOME_PAYMENTS]) : "", form.foreign ? t(form.citizenship ? "Yabancı alıcı · vatandaşlık amaçlı" : "Yabancı alıcı") : ""].filter(Boolean).join(" · ")],
  ];

  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Search size={15} aria-hidden="true"/> {t("BENİM İÇİN BUL")}</span>
      <h1>{t("Aradığınız evi anlatın, danışmanlar size ulaşsın")}</h1>
      <p>{t("Kriterlerinizi bir kez yazın; onaylı emlak danışmanları talebinizi görsün ve size tekliflerle dönsün. Size en fazla 4 danışman ulaşır.")}</p>
      <ol className="request-how">
        <li><ClipboardList size={18} aria-hidden="true"/><span><strong>{t("4 kısa adım")}</strong><small>{t("Ne, nerede, bütçe ve iletişim")}</small></span></li>
        <li><Users size={18} aria-hidden="true"/><span><strong>{t("Danışmanlar teklif verir")}</strong><small>{t("En fazla 4 onaylı danışman ulaşır")}</small></span></li>
        <li><Bell size={18} aria-hidden="true"/><span><strong>{t("Yeni ilan haberi")}</strong><small>{t("Uyan ilanlar e-postanıza gelir")}</small></span></li>
      </ol>
    </div></section>
    <div className="container request-shell">
      {done ? <section className="request-done" role="status">
        <div className="tool-success"><CheckCircle2 size={34} aria-hidden="true"/><h2>{t("Talebiniz iletildi")}</h2>
          <p>{t("Talebiniz danışmanların talep akışında yayında. Bir danışman teklif gönderdiğinde size e-posta ile haber vereceğiz; teklifleri Taleplerim bölümünde görürsünüz.")}</p>
          {done.alert && <p className="request-alert-note"><Bell size={15} aria-hidden="true"/>{t("Bu kriterlere uyan yeni ilanlar için size haber vereceğiz.")}</p>}
          <p><Link className="primary-button" href="/hesabim?tab=aramalar#benim-icin-bul">{t("Taleplerim")}</Link></p></div>
        <div className="request-matches">
          <div className="request-matches-head"><h2>{t("Şu an uyan ilanlar")}</h2>{matches && matches.total > 0 && <Link href={`/ilanlar?${done.search}`}>{t("Tümünü gör ({n})").replace("{n}", String(matches.total))} <ArrowRight size={16} aria-hidden="true"/></Link>}</div>
          {!matches ? <p>{t("Yükleniyor...")}</p> : matches.listings.length ? <div className="results-grid request-match-grid">{matches.listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div>
            : <p className="tool-note">{t("Şu an tam uyan ilan yok; danışmanlar portföylerinden size dönecek.")}</p>}
        </div>
      </section>
      : account === undefined ? <p>{t("Yükleniyor...")}</p>
      : account === null ? <article className="tool-card"><header><Users size={22} aria-hidden="true"/><div><h2>{t("Talep göndermek için giriş yapın")}</h2><p>{t("Talebinizi yalnızca e-postası doğrulanmış üyelerden alıyoruz; böylece danışmanlar gerçek kişilere ulaşır.")}</p></div></header>
        <div className="tool-actions"><Link className="primary-button" href={`/giris?next=${loginNext}`}>{t("Giriş yap")}</Link><Link className="outline-button" href={`/giris?mode=register&next=${loginNext}`}>{t("Ücretsiz kayıt ol")}</Link></div></article>
      : <form className="tool-card request-form" onSubmit={submit} noValidate={step < STEPS.length - 1}>
        <ol className="request-steps" aria-label={t("Adımlar")}>{STEPS.map((item, index) => { const Icon = item.icon; return <li key={item.title} className={index === step ? "current" : index < step ? "done" : ""} aria-current={index === step ? "step" : undefined}>
          <button type="button" disabled={index > step} onClick={() => setStep(index)}><span><Icon size={16} aria-hidden="true"/></span><small>{t("Adım {n}").replace("{n}", String(index + 1))}</small><strong>{t(item.title)}</strong></button></li>; })}</ol>

        {step === 0 && <div className="request-step">
          <fieldset className="tool-field tool-choice request-intent"><legend>{t("Ne istiyorsunuz?")}</legend>
            <label className={buy ? "active" : ""}><input type="radio" name="intent" checked={buy} onChange={() => setForm((old) => ({ ...old, intent: "buy" }))}/>{t("Satın almak istiyorum")}</label>
            <label className={!buy ? "active" : ""}><input type="radio" name="intent" checked={!buy} onChange={() => setForm((old) => ({ ...old, intent: "rent", payment: "", citizenship: false }))}/>{t("Kiralamak istiyorum")}</label></fieldset>
          <div className="tool-field"><span>{t("Kategori")}</span><Chips label={t("Kategori")} options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} selected={[form.category]} onToggle={(value) => setForm((old) => ({ ...old, category: value as Form["category"], types: [], roomsList: value === "konut" ? old.roomsList : [] }))}/></div>
          {HOME_TYPES[form.category].length > 1 && <div className="tool-field"><span>{t("Gayrimenkul tipi")} <small>{t("(birden fazla seçebilirsiniz; boş bırakırsanız hepsi)")}</small></span><Chips label={t("Gayrimenkul tipi")} options={HOME_TYPES[form.category]} selected={form.types} onToggle={(value) => toggle("types", value)}/></div>}
          {form.category === "konut" && <div className="tool-field"><span>{t("Oda sayısı")} <small>{t("(en fazla 3)")}</small></span><Chips label={t("Oda sayısı")} options={HOME_ROOMS.map((value) => ({ value, label: value }))} selected={form.roomsList} max={HOME_REQUEST_LIMITS.rooms} onToggle={(value) => toggle("roomsList", value)}/></div>}
          <label className="tool-field request-narrow"><span>{t("En az brüt alan (m²)")}</span><input inputMode="numeric" value={form.minArea} onChange={(event) => update("minArea", digits(event.target.value).slice(0, 6))} placeholder="100"/></label>
        </div>}

        {step === 1 && <div className="request-step">
          <label className="tool-field request-narrow"><span>{t("İl")}</span><select required value={form.city} onChange={(event) => setForm((old) => ({ ...old, city: event.target.value, districts: [] }))}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          {form.city && <div className="tool-field"><span>{t("İlçeler")} <small>{t("(en fazla 3; boş bırakırsanız ilin tamamı)")}</small></span>
            <Chips label={t("İlçeler")} options={(DISTRICTS[form.city] || []).map((value) => ({ value, label: value }))} selected={form.districts} max={HOME_REQUEST_LIMITS.districts} onToggle={(value) => toggle("districts", value)}/></div>}
          <div className="tool-field"><span>{t("Olmazsa olmazlar")} <small>{t("(isteğe bağlı)")}</small></span><Chips label={t("Olmazsa olmazlar")} options={HOME_FEATURES.filter((item) => buy ? item !== "Evcil hayvan kabul" : item !== "Krediye uygun").map((value) => ({ value, label: value }))} selected={form.features} max={HOME_REQUEST_LIMITS.features} onToggle={(value) => toggle("features", value)}/></div>
        </div>}

        {step === 2 && <div className="request-step">
          <div className="tool-inputs">
            <label className="tool-field"><span>{t(buy ? "En düşük bütçe (TL)" : "En düşük aylık kira (TL)")}</span><input inputMode="numeric" value={money(form.budgetMin)} onChange={(event) => update("budgetMin", digits(event.target.value).slice(0, 12))}/></label>
            <label className="tool-field"><span>{t(buy ? "En yüksek bütçe (TL)" : "En yüksek aylık kira (TL)")}</span><input inputMode="numeric" value={money(form.budgetMax)} onChange={(event) => update("budgetMax", digits(event.target.value).slice(0, 12))} aria-invalid={Boolean(budgetError)}/></label>
          </div>
          <div className="tool-field"><span>{t(buy ? "Ne zaman almayı düşünüyorsunuz?" : "Ne zaman taşınmayı düşünüyorsunuz?")}</span><Chips label={t("Zamanlama")} options={Object.entries(HOME_TIMELINES).map(([value, label]) => ({ value, label }))} selected={[form.timeline]} onToggle={(value) => update("timeline", form.timeline === value ? "" : value)}/></div>
          {buy && <div className="tool-field"><span>{t("Ödeme şekli")}</span><Chips label={t("Ödeme şekli")} options={Object.entries(HOME_PAYMENTS).map(([value, label]) => ({ value, label }))} selected={[form.payment]} onToggle={(value) => update("payment", form.payment === value ? "" : value)}/></div>}
          <label className="check-row request-check"><input type="checkbox" checked={form.foreign} onChange={(event) => setForm((old) => ({ ...old, foreign: event.target.checked, citizenship: event.target.checked && old.citizenship }))}/>{t("Türkiye dışında yaşıyorum / yabancı alıcıyım")}</label>
          {buy && form.foreign && <label className="check-row request-check"><input type="checkbox" checked={form.citizenship} onChange={(event) => update("citizenship", event.target.checked)}/>{t("Yatırım yoluyla vatandaşlık için uygun ev arıyorum")}</label>}
          {buy && form.foreign && <p className="tool-note"><Link href="/yabanci-alici">{t("Yabancı alıcılar için rehber")}</Link></p>}
        </div>}

        {step === 3 && <div className="request-step">
          <dl className="request-summary">{summaryRows.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
          <label className="tool-field"><span>{t("Eklemek istedikleriniz")}</span><textarea maxLength={HOME_REQUEST_LIMITS.noteMax} value={form.note} onChange={(event) => update("note", event.target.value)} placeholder={t("Örn. okula yakın, bahçeli, krediye uygun, taşınma tarihi…")}/></label>
          <div className="tool-inputs">
            <label className="tool-field"><span>{t("Ad soyad")}</span><input required minLength={2} maxLength={100} value={form.name} onChange={(event) => update("name", event.target.value)}/></label>
            <label className="tool-field"><span>{t("E-posta")}</span><input required type="email" maxLength={160} value={form.email} onChange={(event) => update("email", event.target.value)}/></label>
            <label className="tool-field"><span>{t(form.contact === "email" ? "Telefon (isteğe bağlı)" : "Telefon")}</span><input type="tel" required={form.contact !== "email"} maxLength={30} value={form.phone} onChange={(event) => update("phone", event.target.value)}/></label>
          </div>
          <div className="tool-field"><span>{t("Size nasıl ulaşılsın?")}</span><Chips label={t("Size nasıl ulaşılsın?")} options={Object.entries(HOME_CONTACT).map(([value, label]) => ({ value, label }))} selected={[form.contact]} onToggle={(value) => update("contact", value as Form["contact"])}/></div>
          {form.contact !== "email" && <div className="tool-field"><span>{t("Uygun saat")}</span><Chips label={t("Uygun saat")} options={Object.entries(HOME_CONTACT_TIMES).map(([value, label]) => ({ value, label }))} selected={[form.contactTime]} onToggle={(value) => update("contactTime", value as Form["contactTime"])}/></div>}
          <label className="check-row request-check"><input type="checkbox" checked={form.alert} onChange={(event) => update("alert", event.target.checked)}/>{t("Bu kriterlere uyan yeni ilanlar için bana e-posta ile haber ver")}</label>
          <label className="check-row request-check request-consent"><input type="checkbox" required checked={form.consent} onChange={(event) => update("consent", event.target.checked)}/>{t("Talebimin onaylı emlak danışmanlarına açık talep akışında yayınlanmasını ve adımın, e-postamın ve telefonumun talebime ulaşan en fazla 4 danışmanla paylaşılmasını kabul ediyorum.")} <Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link></label>
        </div>}

        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="request-nav">
          {step > 0 ? <button type="button" className="outline-button" onClick={back}><ArrowLeft size={16} aria-hidden="true"/>{t("Geri")}</button> : <span/>}
          {step < STEPS.length - 1 ? <button type="submit" className="primary-button">{t("Devam")}<ArrowRight size={16} aria-hidden="true"/></button>
            : <button type="submit" className="primary-button" disabled={busy || !form.consent}>{t(busy ? "Gönderiliyor..." : "Talebi gönder")}</button>}
        </div>
        <p className="tool-note request-footnote"><ShieldCheck size={14} aria-hidden="true"/> {t("Talebiniz 30 gün açık kalır; istediğiniz zaman kapatabilir veya uzatabilirsiniz.")}</p>
      </form>}
    </div>
  </main>;
}
