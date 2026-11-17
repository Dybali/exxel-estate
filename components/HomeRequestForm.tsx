"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import { HOME_ROOMS } from "@/lib/home-requests";

// /benim-icin-bul: the member describes the home; matching estate agents get the request (lib/home-requests.ts).
type Account = { name?: string; email?: string; phone?: string | null };
const CATEGORY_LABELS = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" } as const;
export function HomeRequestForm() {
  const { t } = useLocale();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [form, setForm] = useState({ intent: "buy", city: "", district: "", category: "konut", rooms: "", budgetMin: "", budgetMax: "", note: "", name: "", email: "", phone: "", consent: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then((response) => response.json() as Promise<{ user?: Account }>).then((data) => {
      setAccount(data.user || null);
      if (data.user) setForm((old) => ({ ...old, name: data.user!.name || "", email: data.user!.email || "", phone: data.user!.phone || "" }));
    }).catch(() => setAccount(null));
  }, []);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((old) => ({ ...old, [key]: event.target.value, ...(key === "city" ? { district: "" } : {}) }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/home-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await apiJson<{ agents?: number; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Talep gönderilemedi.");
      setDone(data.agents || 0); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const next = encodeURIComponent("/benim-icin-bul");
  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Search size={15} aria-hidden="true"/> {t("BENİM İÇİN BUL")}</span>
      <h1>{t("Aradığınız evi anlatın, danışmanlar size ulaşsın")}</h1>
      <p>{t("Kriterlerinizi bir kez yazın; bölgenizde bu tür ilanları olan onaylı emlak danışmanları size uygun seçeneklerle dönsün.")}</p>
    </div></section>
    <div className="container tools-grid">
      {done !== null ? <div className="tool-success" role="status"><CheckCircle2 size={34} aria-hidden="true"/><h2>{t("Talebiniz iletildi")}</h2>
        <p>{t("{n} danışman talebinizi aldı. Size telefon, WhatsApp veya e-posta ile ulaşacaklar.").replace("{n}", String(done))}</p>
        <p><Link href="/hesabim?tab=aramalar">{t("Taleplerim")}</Link> · <Link href="/ilanlar">{t("İlanlara göz atın")}</Link></p></div>
      : account === undefined ? <p>{t("Yükleniyor...")}</p>
      : account === null ? <article className="tool-card"><header><Users size={22} aria-hidden="true"/><div><h2>{t("Talep göndermek için giriş yapın")}</h2><p>{t("Talebinizi yalnızca e-postası doğrulanmış üyelerden alıyoruz; böylece danışmanlar gerçek kişilere ulaşır.")}</p></div></header>
        <div className="tool-actions"><Link className="primary-button" href={`/giris?next=${next}`}>{t("Giriş yap")}</Link><Link className="outline-button" href={`/giris?mode=register&next=${next}`}>{t("Ücretsiz kayıt ol")}</Link></div></article>
      : <form className="tool-card" onSubmit={submit}>
        <fieldset className="tool-field tool-choice"><legend>{t("Ne istiyorsunuz?")}</legend>
          <label><input type="radio" name="intent" checked={form.intent === "buy"} onChange={() => setForm((old) => ({ ...old, intent: "buy" }))}/>{t("Satın almak istiyorum")}</label>
          <label><input type="radio" name="intent" checked={form.intent === "rent"} onChange={() => setForm((old) => ({ ...old, intent: "rent" }))}/>{t("Kiralamak istiyorum")}</label></fieldset>
        <div className="tool-inputs" style={{ marginTop: 16 }}>
          <label className="tool-field"><span>{t("İl")}</span><select required value={form.city} onChange={set("city")}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label className="tool-field"><span>{t("İlçe")}</span><select value={form.district} disabled={!form.city} onChange={set("district")}><option value="">{t("Tüm ilçeler")}</option>{(DISTRICTS[form.city] || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="tool-field"><span>{t("Kategori")}</span><select value={form.category} onChange={set("category")}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          {form.category === "konut" && <label className="tool-field"><span>{t("Oda sayısı")}</span><select value={form.rooms} onChange={set("rooms")}><option value="">{t("Fark etmez")}</option>{HOME_ROOMS.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>}
          <label className="tool-field"><span>{t(form.intent === "buy" ? "En düşük bütçe (TL)" : "En düşük aylık kira (TL)")}</span><input inputMode="numeric" value={form.budgetMin} onChange={set("budgetMin")}/></label>
          <label className="tool-field"><span>{t(form.intent === "buy" ? "En yüksek bütçe (TL)" : "En yüksek aylık kira (TL)")}</span><input inputMode="numeric" value={form.budgetMax} onChange={set("budgetMax")}/></label>
        </div>
        <label className="tool-field" style={{ marginTop: 16 }}><span>{t("Eklemek istedikleriniz")}</span><textarea maxLength={1000} value={form.note} onChange={set("note")} placeholder={t("Örn. okula yakın, bahçeli, krediye uygun, taşınma tarihi…")}/></label>
        <div className="tool-inputs" style={{ marginTop: 16 }}>
          <label className="tool-field"><span>{t("Ad soyad")}</span><input required minLength={2} maxLength={100} value={form.name} onChange={set("name")}/></label>
          <label className="tool-field"><span>{t("E-posta")}</span><input required type="email" maxLength={160} value={form.email} onChange={set("email")}/></label>
          <label className="tool-field"><span>{t("Telefon (isteğe bağlı)")}</span><input type="tel" maxLength={30} value={form.phone} onChange={set("phone")}/></label>
        </div>
        <label className="tool-field tool-choice" style={{ marginTop: 16 }}><span style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 500 }}><input type="checkbox" required checked={form.consent} onChange={(event) => setForm((old) => ({ ...old, consent: event.target.checked }))}/>{t("Adımın, e-postamın ve telefonumun bu talep için seçilen en fazla 8 emlak danışmanıyla paylaşılmasını kabul ediyorum.")}</span></label>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="tool-actions"><button type="submit" className="primary-button" disabled={busy}>{t(busy ? "Gönderiliyor..." : "Talebi gönder")}</button>
          <span className="tool-note" style={{ margin: 0 }}><ShieldCheck size={14} aria-hidden="true"/> {t("Talebiniz 30 gün açık kalır; istediğiniz zaman kapatabilirsiniz.")}</span></div>
      </form>}
    </div>
  </main>;
}
