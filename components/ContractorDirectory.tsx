"use client";
import { useEffect } from "react";
import { trackFirmSearch } from "@/lib/firm-track-client";
import { ArrowRight, BadgeCheck, Building2, CheckCircle2, FlaskConical, HardHat, Handshake, Info, MapPin, Search, Send, Star } from "lucide-react";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { CONTRACTOR_BASE, CONTRACTOR_PANEL, CONTRACTOR_SPECIALTIES, contractorPath, LAND_PATH, specialtyName, type ContractorFirm, type ContractorResults } from "@/lib/contractors";
import { CountryCitySelect } from "@/components/CountryCitySelect";

export type ContractorFilters = { q: string; city: string; specialty: string; verified: boolean; landDeals: boolean; sort: string };

export function ContractorVerifiedBadge() {
  const { t } = useLocale();
  return <span className="service-verified" title={t("Yapı müteahhitliği yetki belgesi yönetici tarafından kontrol edildi.")}><BadgeCheck size={15} aria-hidden="true"/>{t("Doğrulanmış müteahhit")}</span>;
}
export function ContractorSampleBadge({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  return <span className={`service-sample-badge ${className}`.trim()}><FlaskConical size={13} aria-hidden="true"/>{t("Örnek firma")}</span>;
}
export function ContractorSampleNote() {
  const { t } = useLocale();
  return <p className="svc-sample-note" role="note"><Info size={16} aria-hidden="true"/><span>{t("Örnek firmalar, Müteahhitler bölümünün nasıl görüneceğini göstermek içindir. Gerçek firma değildir, iletişim bilgisi yoktur ve sayımlara dahil edilmez.")}</span></p>;
}

/** "İzmir (tüm il) · Turgutlu, Manisa · +2" */
export function useContractorAreaLabel() {
  const { t } = useLocale();
  return (areas: ContractorFirm["areas"], max = 3) => {
    const names = areas.map((area) => area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`);
    return names.length > max ? `${names.slice(0, max).join(" · ")} · +${names.length - max}` : names.join(" · ");
  };
}

export function ContractorCard({ firm }: { firm: ContractorFirm }) {
  const { t, locale } = useLocale(), areaLabel = useContractorAreaLabel();
  const photo = firm.cover || firm.projects.find((project) => project.photos[0])?.photos[0];
  const years = firm.foundedYear ? new Date().getFullYear() - firm.foundedYear : 0;
  return <article className={firm.sample ? "service-firm-card is-sample" : "service-firm-card"}>
    <Link href={contractorPath(firm.id)} className="service-firm-card-link" aria-label={firm.sample ? `${firm.name} · ${t("Örnek firma")}` : firm.name}>
      <div className="service-firm-card-media">
        {photo ? <img src={photo} alt="" loading="lazy"/> : <span className="service-firm-card-placeholder"><HardHat size={34} aria-hidden="true"/></span>}
        {firm.featured && <span className="service-featured"><Star size={13} aria-hidden="true"/>{t("Öne çıkan")}</span>}
        {firm.sample && <ContractorSampleBadge/>}
      </div>
      <div className="service-firm-card-body">
        <div className="service-firm-card-head">
          <span className="service-firm-logo">{firm.logo ? <img src={firm.logo} alt="" loading="lazy"/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
          <div><h3>{firm.name}</h3><span className="service-card-badges">{firm.verified && <ContractorVerifiedBadge/>}{firm.landDeals && <span className="ctr-land-badge"><Handshake size={14} aria-hidden="true"/>{t("Kat karşılığı")}</span>}</span></div>
        </div>
        <ul className="service-firm-tags">{firm.specialties.slice(0, 3).map((slug) => <li key={slug}>{t(specialtyName(slug))}</li>)}{firm.specialties.length > 3 && <li>+{firm.specialties.length - 3}</li>}</ul>
        <p className="ctr-card-facts">
          {years > 0 && <span>{t("{n} yıllık firma").replace("{n}", new Intl.NumberFormat(locale).format(years))}</span>}
          <span>{t("{n} tamamlanan proje").replace("{n}", new Intl.NumberFormat(locale).format(firm.projects.length))}</span>
        </p>
        <p className="service-firm-card-area"><MapPin size={14} aria-hidden="true"/><span>{areaLabel(firm.areas, 2)}</span></p>
      </div>
    </Link>
  </article>;
}

const pageHref = (filters: ContractorFilters, page: number) => {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("il", filters.city);
  if (filters.specialty) params.set("tur", filters.specialty);
  if (filters.verified) params.set("dogrulanmis", "1");
  if (filters.landDeals) params.set("kat", "1");
  if (filters.sort && filters.sort !== "featured") params.set("sirala", filters.sort);
  if (page > 1) params.set("sayfa", String(page));
  const query = params.toString();
  return `${CONTRACTOR_BASE}${query ? `?${query}` : ""}#sonuclar`;
};

/** /muteahhitler: search form (plain GET, works without JavaScript), figures, results, samples, land-request and provider invitations. */
export function ContractorDirectory({ filters, results, samples, stats }: { filters: ContractorFilters; results: ContractorResults; samples: ContractorFirm[]; stats: { firms: number; cities: number; projects: number } }) {
  // "Aramalarda görünme" in each listed firm's statistics.
  const shownIds = results.firms.map((firm) => firm.id).join(",");
  useEffect(() => { trackFirmSearch("contractors", results.firms); }, [shownIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const filtered = Boolean(filters.q || filters.city || filters.specialty || filters.verified || filters.landDeals);
  return <main className="services-page services-landing ctr-page">
    <header className="services-hero ctr-hero">
      <div className="container services-hero-inner">
        <span className="service-kicker light">{t("ESTATEMARKET24 MÜTEAHHİTLER")}</span>
        <h1>{t("Arsanız ve projeniz için güvenilir müteahhitler")}</h1>
        <p>{t("Tamamladıkları projeler, çalıştıkları iller ve yetki belgeleriyle müteahhitleri karşılaştırın; arsanız için kat karşılığı teklif alın.")}</p>
        <form className="ctr-search" action={CONTRACTOR_BASE} method="get" role="search">
          <label className="ctr-search-text"><Search size={17} aria-hidden="true"/><span className="sr-only">{t("Firma adı veya proje")}</span><input name="q" defaultValue={filters.q} maxLength={100} placeholder={t("Firma adı veya proje")}/></label>
          <label><span className="sr-only">{t("İl")}</span><CountryCitySelect name="il" defaultValue={filters.city} placeholder={{ TR: "Tüm iller", DE: "Tüm şehirler" }}/></label>
          <label><span className="sr-only">{t("Uzmanlık")}</span><select name="tur" defaultValue={filters.specialty}><option value="">{t("Tüm uzmanlıklar")}</option>{CONTRACTOR_SPECIALTIES.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</select></label>
          <button type="submit" className="btn btn-accent"><Search size={16} aria-hidden="true"/>{t("Ara")}</button>
          <div className="ctr-search-flags">
            <label><input type="checkbox" name="dogrulanmis" value="1" defaultChecked={filters.verified}/>{t("Yalnızca doğrulanmış müteahhitler")}</label>
            <label><input type="checkbox" name="kat" value="1" defaultChecked={filters.landDeals}/>{t("Kat karşılığı çalışanlar")}</label>
          </div>
        </form>
        <p className="svc-hero-quote"><span>{t("Arsanız mı var?")}</span> <Link href={LAND_PATH} className="btn btn-accent btn-sm"><Send size={15} aria-hidden="true"/>{t("Kat karşılığı teklif al")}</Link></p>
      </div>
    </header>

    <div className="container">
      <dl className="svc-stats">
        <div><dt>{t("Onaylı müteahhit")}</dt><dd>{number(stats.firms)}</dd></div>
        <div><dt>{t("Tamamlanan proje")}</dt><dd>{number(stats.projects)}</dd></div>
        <div><dt>{t("Çalışılan il")}</dt><dd>{number(stats.cities)}<small> / 81</small></dd></div>
      </dl>
    </div>

    <section id="sonuclar" className="container services-featured" aria-labelledby="ctr-results-title">
      <div className="services-section-head svc-section-head">
        <div><h2 id="ctr-results-title">{filtered ? t("{n} müteahhit bulundu").replace("{n}", number(results.total)) : t("Müteahhitler")}</h2>
          <p>{filters.specialty ? t(specialtyName(filters.specialty)) : t("Yönetici onayından geçmiş müteahhit firmaları.")}{filters.city ? ` · ${filters.city}` : ""}</p></div>
        <form action={CONTRACTOR_BASE} method="get" className="ctr-sort">
          {filters.q && <input type="hidden" name="q" value={filters.q}/>}{filters.city && <input type="hidden" name="il" value={filters.city}/>}{filters.specialty && <input type="hidden" name="tur" value={filters.specialty}/>}
          {filters.verified && <input type="hidden" name="dogrulanmis" value="1"/>}{filters.landDeals && <input type="hidden" name="kat" value="1"/>}
          <label>{t("Sıralama")}<select name="sirala" defaultValue={filters.sort} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="featured">{t("Öne çıkanlar")}</option><option value="newest">{t("En yeni")}</option><option value="az">{t("A–Z")}</option>
          </select></label>
          <noscript><button type="submit" className="btn btn-secondary btn-sm">{t("Uygula")}</button></noscript>
        </form>
      </div>
      {results.firms.length ? <div className="service-firm-grid">{results.firms.map((firm) => <ContractorCard key={firm.id} firm={firm}/>)}</div>
        : <div className="ctr-empty"><HardHat size={30} aria-hidden="true"/><p>{t(filtered ? "Bu ölçütlere uyan onaylı müteahhit henüz yok." : "Henüz onaylı müteahhit yok. İlk firma siz olun.")}</p>
          {filtered && <Link href={`${CONTRACTOR_BASE}#sonuclar`} className="btn btn-secondary btn-sm">{t("Filtreleri temizle")}</Link>}</div>}
      {results.pages > 1 && <nav className="svc-pagination" aria-label={t("Sayfalar")}>
        {results.page > 1 && <Link className="svc-page-step" href={pageHref(filters, results.page - 1)}>{t("Önceki")}</Link>}
        <span className="svc-page-gap">{t("Sayfa {n} / {m}").replace("{n}", number(results.page)).replace("{m}", number(results.pages))}</span>
        {results.page < results.pages && <Link className="svc-page-step" href={pageHref(filters, results.page + 1)}>{t("Sonraki")}</Link>}
      </nav>}
    </section>

    {samples.length > 0 && <section className="container services-featured" aria-labelledby="ctr-samples-title">
      <div className="services-section-head svc-section-head"><div><h2 id="ctr-samples-title">{t("Örnek müteahhit profilleri")}</h2></div></div>
      <ContractorSampleNote/>
      <div className="service-firm-grid">{samples.map((firm) => <ContractorCard key={firm.id} firm={firm}/>)}</div>
    </section>}

    <div className="container ctr-split">
      <section className="service-cta" aria-labelledby="ctr-land-title">
        <div className="service-cta-text">
          <span className="service-kicker"><Handshake size={15} aria-hidden="true"/>{t("Arsa sahipleri için")}</span>
          <h2 id="ctr-land-title">{t("Arsanızı bir kez anlatın, müteahhitler teklif versin")}</h2>
          <ul>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Talebiniz bölgenizde kat karşılığı çalışan onaylı müteahhitlere gider.")}</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Teklifleri pay oranı ve teslim süresiyle yan yana karşılaştırırsınız.")}</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("İletişim bilgileriniz yalnızca seçtiğiniz müteahhitle paylaşılır.")}</li>
          </ul>
        </div>
        <Link href={LAND_PATH} className="btn btn-accent service-cta-button">{t("Kat karşılığı teklif al")}<ArrowRight size={17} aria-hidden="true"/></Link>
      </section>
      <section className="service-cta" aria-labelledby="ctr-provider-title">
        <div className="service-cta-text">
          <span className="service-kicker"><HardHat size={15} aria-hidden="true"/>{t("Müteahhit misiniz?")}</span>
          <h2 id="ctr-provider-title">{t("Firmanızı ekleyin, arsa sahiplerine ulaşın")}</h2>
          <ul>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Firma profili ücretsizdir; müteahhit hesabıyla açılır.")}</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Profiliniz yönetici onayından sonra yayınlanır.")}</li>
            <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Satıştaki projelerinizi Projeler bölümünde ayrıca yayınlayabilirsiniz.")}</li>
          </ul>
        </div>
        <Link href={CONTRACTOR_PANEL} className="btn btn-secondary service-cta-button">{t("Firmanızı ekleyin")}<ArrowRight size={17} aria-hidden="true"/></Link>
      </section>
    </div>
    <div className="container"><p className="region-up"><Link href="/projeler"><Building2 size={15} aria-hidden="true"/>{t("Satıştaki konut projelerini görün")}<ArrowRight size={15} aria-hidden="true"/></Link></p></div>
    <p className="container services-disclaimer">{t("estatemarket24 müteahhitleri yayınlamadan önce bilgilerini inceler; ancak taraflar arasındaki sözleşmenin tarafı değildir. Kat karşılığı anlaşmalarını noter onaylı sözleşmeyle ve bir avukata danışarak yapın.")}</p>
  </main>;
}
