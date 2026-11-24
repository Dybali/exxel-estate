"use client";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, ClipboardList, Hammer, LandPlot, LogIn, Send, ShieldCheck, Timer } from "lucide-react";
import Link from "@/components/SafeLink";
import { FindForMeSwitch } from "@/components/FindForMeSwitch";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { BUILD_WORKS, CONTRACTOR_BASE, contractorPath, LAND_LIMITS, LAND_PANEL, LAND_PATH, LAND_ZONINGS, type LandKind } from "@/lib/contractors";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

type Account = { name: string; email: string; phone?: string | null } | null;

/** /muteahhitler/kat-karsiligi ("Benim için müteahhit bul"): the owner describes the plot or the job once; matching
 * contractors (or one) send offers. kind "land" = kat karşılığı (share of the flats), "build" = paid construction or
 * renovation (TL price); ?tur=insaat opens the second (owner's request 2026-11-24). */
export function LandRequestForm({ firm, initialCity, initialKind = "land" }: { firm: { id: string; name: string } | null; initialCity: string; initialKind?: LandKind }) {
  const { t } = useLocale();
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [kind, setKind] = useState<LandKind>(initialKind);
  const [form, setForm] = useState({ city: initialCity, district: "", work: "", areaM2: "", zoning: "", emsal: "", expectedShare: "", budgetMin: "", budgetMax: "", description: "", name: "", email: "", phone: "", shareContact: false, consent: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<number | null>(null);
  const build = kind === "build";
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (response) => await response.json() as { user?: Account }).then((data) => {
      const user = data.user || null;
      setAccount(user);
      if (user) setForm((old) => ({ ...old, name: old.name || user.name || "", email: old.email || user.email || "", phone: old.phone || user.phone || "" }));
    }).catch(() => setAccount(null));
  }, []);
  // Keeps the address in step with the chosen kind, so a shared or reloaded link opens the same form.
  function choose(next: LandKind) {
    setKind(next); setError("");
    const url = new URL(window.location.href);
    if (next === "build") url.searchParams.set("tur", "insaat"); else url.searchParams.delete("tur");
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  const set = (key: "areaM2" | "emsal" | "expectedShare" | "budgetMin" | "budgetMax" | "description" | "name" | "email" | "phone") => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((old) => ({ ...old, [key]: event.target.value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractors/land", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, kind, firmId: firm?.id || null }) });
      const data = await apiJson<{ error?: string; recipients?: number }>(response);
      if (!response.ok) throw new Error(data.error || "Talebiniz gönderilemedi.");
      setDone(data.recipients || 0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const login = `/giris?next=${encodeURIComponent(typeof window === "undefined" ? LAND_PATH : window.location.pathname + window.location.search)}`;
  const heading = firm
    ? t(build ? "{firma} firmasından inşaat teklifi isteyin" : "{firma} firmasından kat karşılığı teklif isteyin").replace("{firma}", firm.name)
    : t(build ? "Evinizi, binanızı veya tadilatınızı yapacak müteahhidi bulun" : "Arsanız için kat karşılığı teklif alın");
  const lead = firm ? t("Talebiniz yalnızca bu müteahhide gönderilir. Teklif site üzerinden gelir.")
    : t(build ? "Ne yaptırmak istediğinizi bir kez anlatın; bölgenizdeki onaylı müteahhitler size fiyat ve teslim süresiyle teklif göndersin." : "Arsanızı bir kez anlatın; bölgenizde kat karşılığı çalışan onaylı müteahhitler size pay oranı ve teslim süresiyle teklif göndersin.");

  return <main className="services-page svc-quote-page">
    <div className="container">
      <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
        <li><Link href={CONTRACTOR_BASE}>{t("Müteahhitler")}</Link></li>
        {firm && <li><ChevronRight size={13} aria-hidden="true"/><Link href={contractorPath(firm.id)}>{firm.name}</Link></li>}
        <li><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">{t(build ? "İnşaat teklifi al" : "Kat karşılığı teklif al")}</span></li>
      </ol></nav>
      {!firm && <FindForMeSwitch active="muteahhit"/>}
    </div>
    <div className="container svc-quote-layout">
      <section className="svc-quote-main">
        <span className="service-kicker">{t("ÜCRETSİZ VE YÜKÜMLÜLÜKSÜZ")}</span>
        <h1>{heading}</h1>
        <p className="svc-quote-lead">{lead}</p>

        {done !== null ? <div className="svc-quote-done" role="status">
          <CheckCircle2 size={34} aria-hidden="true"/>
          <h2>{t("Talebiniz gönderildi")}</h2>
          <p>{t("Talebiniz {n} müteahhide iletildi. Gelen teklifleri e-posta ile haber veririz; hepsini Hesabım › Tekliflerim bölümünde karşılaştırabilirsiniz.").replace("{n}", String(done))}</p>
          <div className="project-editor-actions"><Link className="btn btn-primary" href={LAND_PANEL}>{t("Müteahhit taleplerim")}<ArrowRight size={16} aria-hidden="true"/></Link><Link className="btn btn-secondary" href={CONTRACTOR_BASE}>{t("Müteahhitlere dön")}</Link></div>
        </div>
        : account === undefined ? <p>{t("Yükleniyor...")}</p>
        : !account ? <div className="svc-quote-login">
          <LogIn size={26} aria-hidden="true"/>
          <div><h2>{t("Teklif istemek için giriş yapın")}</h2><p>{t("Gelen teklifleri hesabınızda karşılaştırabilmeniz için üyelik gerekir. Google ile birkaç saniyede giriş yapabilirsiniz.")}</p></div>
          <Link className="btn btn-accent" href={login}>{t("Giriş yap veya üye ol")}<ArrowRight size={16} aria-hidden="true"/></Link>
        </div>
        : <form className="svc-quote-form" onSubmit={submit}>
          <div className="ctr-kind" role="radiogroup" aria-label={t("Ne istiyorsunuz?")}>
            <button type="button" role="radio" aria-checked={build} className={build ? "active" : ""} onClick={() => choose("build")}>
              <Hammer size={20} aria-hidden="true"/><span><strong>{t("İnşaat veya tadilat yaptırmak istiyorum")}</strong><small>{t("Ev, villa, apartman, kentsel dönüşüm veya büyük tadilat; müteahhit fiyat verir.")}</small></span></button>
            <button type="button" role="radio" aria-checked={!build} className={!build ? "active" : ""} onClick={() => choose("land")}>
              <LandPlot size={20} aria-hidden="true"/><span><strong>{t("Arsamı kat karşılığı vermek istiyorum")}</strong><small>{t("Para ödemezsiniz; müteahhit size dairelerden pay teklif eder.")}</small></span></button>
          </div>
          <fieldset><legend><span>1</span>{t(build ? "İş nerede yapılacak?" : "Arsa nerede?")}</legend>
            <div className="project-editor-grid">
              <label>{t("İl")}<select required value={form.city} onChange={(event) => setForm((old) => ({ ...old, city: event.target.value, district: "" }))}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label>{t("İlçe")}<select value={form.district} disabled={!form.city} onChange={(event) => setForm((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm il")}</option>{districtsFor(form.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></label>
            </div>
          </fieldset>
          {build ? <fieldset><legend><span>2</span>{t("Ne yaptırmak istiyorsunuz?")}</legend>
            <div className="project-editor-grid">
              <label>{t("İşin türü")}<select required value={form.work} onChange={(event) => setForm((old) => ({ ...old, work: event.target.value }))}><option value="">{t("Seçin")}</option>{BUILD_WORKS.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>
              <label>{t("Arsa veya bina alanı (m²)")}<input required type="number" inputMode="numeric" min={20} max={1000000} value={form.areaM2} onChange={set("areaM2")}/></label>
              <label>{t("İmar durumu (isteğe bağlı)")}<select value={form.zoning} onChange={(event) => setForm((old) => ({ ...old, zoning: event.target.value }))}><option value="">{t("Bilmiyorum / gerekmiyor")}</option>{LAND_ZONINGS.filter((item) => item.slug !== "bilinmiyor").map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>
              <label>{t("Bütçe en az (TL, isteğe bağlı)")}<input type="number" inputMode="numeric" min={1} placeholder="3000000" value={form.budgetMin} onChange={set("budgetMin")}/></label>
              <label>{t("Bütçe en çok (TL, isteğe bağlı)")}<input type="number" inputMode="numeric" min={1} placeholder="5000000" value={form.budgetMax} onChange={set("budgetMax")}/></label>
            </div>
            <label>{t("İşi anlatın")}<textarea required rows={6} minLength={20} maxLength={2000} value={form.description} onChange={set("description")}
              placeholder={t("Örn. 400 m² arsaya 2 katlı, 4+1 villa; projesi hazır, ruhsat alınacak. Anahtar teslim istiyoruz, 12 ay içinde bitmesi gerekiyor.")}/>
              <small>{form.description.trim().length}/2000</small></label>
            <p className="project-editor-note">{t("Proje, ruhsat veya keşif belgeleriniz varsa müteahhit teklif verdikten sonra paylaşabilirsiniz.")}</p>
          </fieldset>
          : <fieldset><legend><span>2</span>{t("Arsa bilgileri")}</legend>
            <div className="project-editor-grid">
              <label>{t("Arsa alanı (m²)")}<input required type="number" inputMode="numeric" min={50} max={1000000} value={form.areaM2} onChange={set("areaM2")}/></label>
              <label>{t("İmar durumu")}<select required value={form.zoning} onChange={(event) => setForm((old) => ({ ...old, zoning: event.target.value }))}><option value="">{t("Seçin")}</option>{LAND_ZONINGS.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>
              <label>{t("Emsal / KAKS (isteğe bağlı)")}<input inputMode="decimal" maxLength={5} placeholder="1,20" value={form.emsal} onChange={set("emsal")}/></label>
              <label>{t("Beklediğiniz pay % (isteğe bağlı)")}<input type="number" inputMode="numeric" min={1} max={99} placeholder="50" value={form.expectedShare} onChange={set("expectedShare")}/></label>
            </div>
            <label>{t("Arsayı anlatın")}<textarea required rows={6} minLength={20} maxLength={2000} value={form.description} onChange={set("description")}
              placeholder={t("Örn. köşe parsel, iki yola cepheli, üzerinde eski bina var, hisseli değil, tapu ve imar durumu belgesi hazır.")}/>
              <small>{form.description.trim().length}/2000</small></label>
            <p className="project-editor-note">{t("Ada ve parsel numarası yazmanız gerekmez; müteahhit teklif verdikten sonra paylaşabilirsiniz.")}</p>
          </fieldset>}
          <fieldset><legend><span>3</span>{t("İletişim bilgileriniz")}</legend>
            <div className="project-editor-grid">
              <label>{t("Ad soyad")}<input required maxLength={100} value={form.name} onChange={set("name")}/></label>
              <label>{t("E-posta")}<input required type="email" maxLength={254} value={form.email} onChange={set("email")}/></label>
              <label>{t("Telefon (isteğe bağlı)")}<input type="tel" inputMode="tel" maxLength={25} value={form.phone} onChange={set("phone")}/></label>
            </div>
            <label className="service-terms"><input type="checkbox" checked={form.shareContact} onChange={(event) => setForm((old) => ({ ...old, shareContact: event.target.checked }))}/>{t("Müteahhitler beni doğrudan arayabilir (telefon ve e-postam talebi alan müteahhitlere gösterilir).")}</label>
            <p className="project-editor-note">{t("Bu seçeneği işaretlemezseniz müteahhitler yalnızca adınızı görür; iletişim bilgileriniz ancak bir teklifi kabul ettiğinizde o firmayla paylaşılır.")}</p>
          </fieldset>
          <label className="service-terms"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm((old) => ({ ...old, consent: event.target.checked }))}/>
            <span>{t(firm ? "Talebimin bu müteahhide iletilmesini onaylıyorum." : build ? "Talebimin bu bölgedeki onaylı müteahhitlere (en fazla 12) iletilmesini onaylıyorum." : "Talebimin bu bölgede kat karşılığı çalışan onaylı müteahhitlere (en fazla 12) iletilmesini onaylıyorum.")} <Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link></span></label>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button type="submit" className="btn btn-accent btn-block svc-quote-submit" disabled={busy}><Send size={17} aria-hidden="true"/>{t(busy ? "Gönderiliyor..." : "Teklif talebini gönder")}</button>
        </form>}
      </section>
      <aside className="svc-quote-aside" aria-label={t("Nasıl çalışır?")}>
        <h2>{t("Nasıl çalışır?")}</h2>
        {build ? <ol className="svc-quote-steps">
          <li><ClipboardList size={20} aria-hidden="true"/><div><strong>{t("İşinizi anlatın")}</strong><p>{t("Ne yaptırmak istediğinizi, yeri, alanı ve bütçenizi birkaç dakikada yazın.")}</p></div></li>
          <li><Timer size={20} aria-hidden="true"/><div><strong>{t("Fiyat teklifleri gelsin")}</strong><p>{t("Müteahhitler TL fiyat, teslim süresi ve açıklamayla teklif gönderir; e-posta ile haber veririz.")}</p></div></li>
          <li><BadgeCheck size={20} aria-hidden="true"/><div><strong>{t("Karşılaştırın ve seçin")}</strong><p>{t("Teklifleri en uygundan başlayarak, tamamlanan projeler ve yetki belgeleriyle görün; size uyanı kabul edin.")}</p></div></li>
        </ol> : <ol className="svc-quote-steps">
          <li><ClipboardList size={20} aria-hidden="true"/><div><strong>{t("Arsanızı anlatın")}</strong><p>{t("İl, ilçe, alan ve imar durumunu birkaç dakikada yazın.")}</p></div></li>
          <li><Timer size={20} aria-hidden="true"/><div><strong>{t("Teklifler gelsin")}</strong><p>{t("Müteahhitler size kalacak pay oranı, teslim süresi ve açıklamayla teklif gönderir; e-posta ile haber veririz.")}</p></div></li>
          <li><BadgeCheck size={20} aria-hidden="true"/><div><strong>{t("Karşılaştırın ve seçin")}</strong><p>{t("Teklifleri, tamamlanan projeleri ve yetki belgelerini yan yana görün; size uyanı kabul edin.")}</p></div></li>
        </ol>}
        <p className="svc-quote-safe"><ShieldCheck size={18} aria-hidden="true"/>{t("Ücretsizdir ve sizi hiçbir teklifi kabul etmeye zorlamaz. Talepler 30 gün sonra kendiliğinden kapanır; günde en fazla {n} talep gönderebilirsiniz.").replace("{n}", String(LAND_LIMITS.perDay))}</p>
      </aside>
    </div>
  </main>;
}
