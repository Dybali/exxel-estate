"use client";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, ClipboardList, LogIn, Send, ShieldCheck, Timer } from "lucide-react";
import Link from "@/components/SafeLink";
import { FindForMeSwitch } from "@/components/FindForMeSwitch";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { categoriesOf, SERVICE_GROUPS, serviceCategory } from "@/lib/service-categories";
import { QUOTE_LIMITS, QUOTE_TIMINGS, type QuoteTiming } from "@/lib/service-extras";
import { firmPath, SERVICE_BASE, SERVICE_QUOTE_PATH } from "@/lib/services";
import { areaDistricts as districtsFor } from "@/lib/service-locations";
import { CountryCitySelect } from "@/components/CountryCitySelect";

type Initial = { category: string; city: string; district: string };
type Account = { name: string; email: string; phone?: string | null; email_verified?: number } | null;

/** /hizmetler/teklif-iste: the member describes the job once; matching firms (or one firm) answer with offers. */
export function ServiceQuoteForm({ initial, firm }: { initial: Initial; firm: { id: string; name: string; categories: string[] } | null }) {
  const { t } = useLocale();
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [form, setForm] = useState({ ...initial, description: "", timing: "asap" as QuoteTiming, name: "", email: "", phone: "", shareContact: true, consent: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (response) => await response.json() as { user?: Account }).then((data) => {
      const user = data.user || null;
      setAccount(user);
      if (user) setForm((old) => ({ ...old, name: old.name || user.name || "", email: old.email || user.email || "", phone: old.phone || user.phone || "" }));
    }).catch(() => setAccount(null));
  }, []);
  const set = (key: "description" | "name" | "email" | "phone") => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((old) => ({ ...old, [key]: event.target.value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/services/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, firmId: firm?.id || null }) });
      const data = await apiJson<{ error?: string; recipients?: number }>(response);
      if (!response.ok) throw new Error(data.error || "Talebiniz gönderilemedi.");
      setDone(data.recipients || 0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const login = `/giris?next=${encodeURIComponent(typeof window === "undefined" ? SERVICE_QUOTE_PATH : window.location.pathname + window.location.search)}`;
  const groups = firm ? null : SERVICE_GROUPS;
  const chosen = serviceCategory(form.category);

  return <main className="services-page svc-quote-page">
    <div className="container">
      <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
        <li><Link href={SERVICE_BASE}>{t("Hizmetler")}</Link></li>
        {firm && <li><ChevronRight size={13} aria-hidden="true"/><Link href={firmPath(firm.id)}>{firm.name}</Link></li>}
        <li><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">{t("Teklif iste")}</span></li>
      </ol></nav>
      {!firm && <FindForMeSwitch active="hizmet"/>}
    </div>
    <div className="container svc-quote-layout">
      <section className="svc-quote-main">
        <span className="service-kicker">{t("ÜCRETSİZ VE YÜKÜMLÜLÜKSÜZ")}</span>
        <h1>{firm ? t("{firma} firmasından teklif isteyin").replace("{firma}", firm.name) : t("Ücretsiz teklif alın")}</h1>
        <p className="svc-quote-lead">{firm ? t("Talebiniz yalnızca bu firmaya gönderilir. Firma fiyat teklifini site üzerinden iletir.") : t("İşinizi bir kez anlatın; bölgenizdeki onaylı firmalar size fiyat teklifi göndersin. Teklifleri yan yana karşılaştırın, size uygun olanı seçin.")}</p>

        {done !== null ? <div className="svc-quote-done" role="status">
          <CheckCircle2 size={34} aria-hidden="true"/>
          <h2>{t("Talebiniz gönderildi")}</h2>
          <p>{t("Talebiniz {n} firmaya iletildi. Gelen teklifleri e-posta ile haber veririz; hepsini Hesabım › Teklif taleplerim bölümünde karşılaştırabilirsiniz.").replace("{n}", String(done))}</p>
          <div className="project-editor-actions"><Link className="btn btn-primary" href="/hesabim?tab=teklifler">{t("Teklif taleplerim")}<ArrowRight size={16} aria-hidden="true"/></Link><Link className="btn btn-secondary" href={SERVICE_BASE}>{t("Hizmetlere dön")}</Link></div>
        </div>
        : account === undefined ? <p>{t("Yükleniyor...")}</p>
        : !account ? <div className="svc-quote-login">
          <LogIn size={26} aria-hidden="true"/>
          <div><h2>{t("Teklif istemek için giriş yapın")}</h2><p>{t("Gelen teklifleri hesabınızda karşılaştırabilmeniz ve firmaların size güvenle ulaşabilmesi için üyelik gerekir. Google ile birkaç saniyede giriş yapabilirsiniz.")}</p></div>
          <Link className="btn btn-accent" href={login}>{t("Giriş yap veya üye ol")}<ArrowRight size={16} aria-hidden="true"/></Link>
        </div>
        : <form className="svc-quote-form" onSubmit={submit}>
          <fieldset><legend><span>1</span>{t("Hangi hizmet?")}</legend>
            <label>{t("Hizmet kategorisi")}<select required value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}>
              <option value="">{t("Seçin")}</option>
              {groups ? groups.map((group) => <optgroup key={group.id} label={t(group.name)}>{categoriesOf(group.id).map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</optgroup>)
                : firm!.categories.map((slug) => <option key={slug} value={slug}>{t(serviceCategory(slug)?.name || slug)}</option>)}
            </select></label>
          </fieldset>
          <fieldset><legend><span>2</span>{t("İş nerede?")}</legend>
            <div className="project-editor-grid">
              <label>{t("İl")}<CountryCitySelect required value={form.city} onChange={(city) => setForm((old) => ({ ...old, city, district: "" }))} placeholder={{ TR: "Seçin", DE: "Şehir seçin" }}/></label>
              <label>{t("İlçe")}<select value={form.district} disabled={!districtsFor(form.city).length} onChange={(event) => setForm((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm il")}</option>{districtsFor(form.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
            </div>
          </fieldset>
          <fieldset><legend><span>3</span>{t("İşi anlatın")}</legend>
            <label>{t("İşin açıklaması")}<textarea required rows={6} minLength={QUOTE_LIMITS.descriptionMin} maxLength={QUOTE_LIMITS.descriptionMax} value={form.description} onChange={set("description")}
              placeholder={t(chosen?.slug === "boyaci-badanaci" ? "Örn. 3+1 daire, yaklaşık 110 m², tavanlar dahil iç cephe boyası. Eşyalar evde." : "Ne yapılmasını istiyorsunuz? Ölçü, adet, malzeme ve ulaşım gibi bilgiler daha doğru teklif almanızı sağlar.")}/>
              <small>{form.description.trim().length}/{QUOTE_LIMITS.descriptionMax}</small></label>
            <div className="svc-timing" role="radiogroup" aria-label={t("Ne zaman?")}>{(Object.keys(QUOTE_TIMINGS) as QuoteTiming[]).map((value) => <label key={value} className={form.timing === value ? "active" : ""}>
              <input type="radio" name="timing" value={value} checked={form.timing === value} onChange={() => setForm((old) => ({ ...old, timing: value }))}/>{t(QUOTE_TIMINGS[value])}</label>)}</div>
          </fieldset>
          <fieldset><legend><span>4</span>{t("İletişim bilgileriniz")}</legend>
            <div className="project-editor-grid">
              <label>{t("Ad soyad")}<input required maxLength={100} value={form.name} onChange={set("name")}/></label>
              <label>{t("E-posta")}<input required type="email" maxLength={254} value={form.email} onChange={set("email")}/></label>
              <label>{t("Telefon (isteğe bağlı)")}<input type="tel" inputMode="tel" maxLength={25} value={form.phone} onChange={set("phone")}/></label>
            </div>
            <label className="service-terms"><input type="checkbox" checked={form.shareContact && Boolean(form.phone.trim())} disabled={!form.phone.trim()} onChange={(event) => setForm((old) => ({ ...old, shareContact: event.target.checked }))}/>{t("Firmalar beni telefonla arayabilir (telefon ve e-postam talebi alan firmalara gösterilir).")}</label>
            <p className="project-editor-note">{t("Bu seçeneği işaretlemezseniz firmalar yalnızca adınızı görür; iletişim bilgileriniz ancak bir teklifi kabul ettiğinizde o firmayla paylaşılır.")}</p>
          </fieldset>
          <label className="service-terms"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm((old) => ({ ...old, consent: event.target.checked }))}/>
            <span>{t(firm ? "Talebimin bu firmaya iletilmesini onaylıyorum." : "Talebimin bu hizmeti bu bölgede veren uygun firmalara (en fazla 12) iletilmesini onaylıyorum.")} <Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link></span></label>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button type="submit" className="btn btn-accent btn-block svc-quote-submit" disabled={busy}><Send size={17} aria-hidden="true"/>{t(busy ? "Gönderiliyor..." : "Teklif talebini gönder")}</button>
        </form>}
      </section>
      <aside className="svc-quote-aside" aria-label={t("Nasıl çalışır?")}>
        <h2>{t("Nasıl çalışır?")}</h2>
        <ol className="svc-quote-steps">
          <li><ClipboardList size={20} aria-hidden="true"/><div><strong>{t("İşinizi anlatın")}</strong><p>{t("Birkaç dakikada ne istediğinizi, nerede ve ne zaman yapılacağını yazın.")}</p></div></li>
          <li><Timer size={20} aria-hidden="true"/><div><strong>{t("Teklifler gelsin")}</strong><p>{t("Bölgenizdeki onaylı firmalar fiyat ve açıklamayla teklif gönderir; e-posta ile haber veririz.")}</p></div></li>
          <li><BadgeCheck size={20} aria-hidden="true"/><div><strong>{t("Karşılaştırın ve seçin")}</strong><p>{t("Fiyatları, belgeleri ve firma profillerini yan yana görün; size uyanı kabul edin.")}</p></div></li>
        </ol>
        <p className="svc-quote-safe"><ShieldCheck size={18} aria-hidden="true"/>{t("Ücretsizdir ve sizi hiçbir teklifi kabul etmeye zorlamaz. Talepler 30 gün sonra kendiliğinden kapanır.")}</p>
      </aside>
    </div>
  </main>;
}
