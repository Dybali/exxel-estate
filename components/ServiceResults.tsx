"use client";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trackFirmSearch } from "@/lib/firm-track-client";
import Link from "@/components/SafeLink";
import { ServiceFirmCard } from "@/components/ServiceFirmCard";
import { ServiceIcon } from "@/components/ServiceIcon";
import { ServiceSampleNote } from "@/components/ServicesLanding";
import { useLocale } from "@/lib/i18n";
import { categoriesOf, SERVICE_GROUPS, type ServiceSlug } from "@/lib/service-categories";
import { EMPTY_SERVICE_FILTERS, SERVICE_SEARCH_PATH, serviceSearchHref, servicePageList, withLang, type ServiceFilters } from "@/lib/service-search";
import type { ServiceFirm, ServiceSort } from "@/lib/services";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

const go = (filters: ServiceFilters) => window.location.assign(withLang(serviceSearchHref(filters), new URLSearchParams(window.location.search).get("lang")));
const SORT_LABELS: Record<ServiceSort, string> = { featured: "Öne çıkanlar", newest: "En yeni", az: "A–Z" };

/** Filter sidebar (desktop) and filter drawer (phones); every change ends in a shareable address. */
function ServiceFilterForm({ filters, counts, onClose }: { filters: ServiceFilters; counts: Record<ServiceSlug, number>; onClose?: () => void }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [form, setForm] = useState(filters);
  // Wide screens apply a choice at once; the phone drawer waits for "Sonuçları göster".
  const apply = (next: ServiceFilters) => { setForm(next); if (!onClose && window.matchMedia("(min-width: 1001px)").matches) go({ ...next, page: 1 }); };
  const toggle = (slug: ServiceSlug) => apply({ ...form, categories: form.categories.includes(slug) ? form.categories.filter((item) => item !== slug) : [...form.categories, slug] });
  return <form className="svc-filters" role="search" aria-label={t("Filtreler")} onSubmit={(event) => { event.preventDefault(); go({ ...form, page: 1 }); }}>
    <label className="svc-filter-field"><span>{t("Firma adı veya açıklama")}</span>
      <input type="search" value={form.q} maxLength={100} placeholder={t("Örn. boyacı, nakliyat, firma adı")} enterKeyHint="search" onChange={(event) => setForm({ ...form, q: event.target.value })}/>
    </label>
    <label className="svc-filter-field"><span>{t("İl")}</span>
      <select value={form.city} onChange={(event) => apply({ ...form, city: event.target.value, district: "" })}>
        <option value="">{t("Tüm Türkiye")}</option>
        {CITIES.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
    <label className="svc-filter-field"><span>{t("İlçe")}</span>
      <select value={form.district} disabled={!form.city} onChange={(event) => apply({ ...form, district: event.target.value })}>
        <option value="">{t("Tüm ilçeler")}</option>
        {districtsFor(form.city).map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
    <label className="svc-check svc-check-flag"><input type="checkbox" checked={form.verified} onChange={(event) => apply({ ...form, verified: event.target.checked })}/><span>{t("Doğrulanmış firmalar")}</span></label>
    <label className="svc-check svc-check-flag"><input type="checkbox" checked={form.documented} onChange={(event) => apply({ ...form, documented: event.target.checked })}/><span>{t("Belgeli firmalar")}</span></label>
    <label className="svc-check svc-check-flag"><input type="checkbox" checked={form.emergency} onChange={(event) => apply({ ...form, emergency: event.target.checked })}/><span>{t("7/24 acil hizmet")}</span></label>
    <label className="svc-check svc-check-flag"><input type="checkbox" checked={form.photos} onChange={(event) => apply({ ...form, photos: event.target.checked })}/><span>{t("Fotoğraflı")}</span></label>
    <fieldset className="svc-filter-categories"><legend>{t("Hizmet kategorileri")}</legend>
      {SERVICE_GROUPS.map((group) => {
        const items = categoriesOf(group.id);
        return <details key={group.id} open={items.some((item) => form.categories.includes(item.slug as ServiceSlug))}>
          <summary><ServiceIcon name={group.icon} size={16}/><span>{t(group.name)}</span></summary>
          {items.map((item) => <label key={item.slug} className="svc-check">
            <input type="checkbox" checked={form.categories.includes(item.slug as ServiceSlug)} onChange={() => toggle(item.slug as ServiceSlug)}/>
            <span>{t(item.name)}</span><small>{number(counts[item.slug as ServiceSlug] || 0)}</small>
          </label>)}
        </details>;
      })}
    </fieldset>
    <div className="svc-filter-actions">
      <button type="submit" className="btn btn-primary btn-block">{t("Sonuçları göster")}</button>
      <Link href={SERVICE_SEARCH_PATH} className="btn btn-ghost btn-block">{t("Filtreleri temizle")}</Link>
    </div>
  </form>;
}

function Pagination({ filters, page, pages }: { filters: ServiceFilters; page: number; pages: number }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  if (pages < 2) return null;
  const href = (target: number) => serviceSearchHref({ ...filters, page: target });
  return <nav className="svc-pagination" aria-label={t("Sayfalar")}>
    {page > 1 ? <Link href={href(page - 1)} className="svc-page-step" rel="prev"><ChevronLeft size={16} aria-hidden="true"/>{t("Önceki")}</Link> : <span className="svc-page-step" aria-disabled="true"><ChevronLeft size={16} aria-hidden="true"/>{t("Önceki")}</span>}
    <ol>{servicePageList(page, pages).map((item, index) => item === null
      ? <li key={`gap-${index}`} className="svc-page-gap" aria-hidden="true">…</li>
      : <li key={item}>{item === page ? <span aria-current="page">{number(item)}</span> : <Link href={href(item)} aria-label={t("Sayfa {n}").replace("{n}", String(item))}>{number(item)}</Link>}</li>)}</ol>
    {page < pages ? <Link href={href(page + 1)} className="svc-page-step" rel="next">{t("Sonraki")}<ChevronRight size={16} aria-hidden="true"/></Link> : <span className="svc-page-step" aria-disabled="true">{t("Sonraki")}<ChevronRight size={16} aria-hidden="true"/></span>}
  </nav>;
}

/** `total` is real firms only; `samples` counts the sample firms listed after them (lib/service-samples.ts). */
export type ServiceResultsData = { firms: ServiceFirm[]; total: number; page: number; pages: number; perPage: number; samples?: number };

/**
 * Results of /hizmetler/ara and of every category/region page: filter sidebar, count, sort, firm
 * cards, page numbers. `empty` replaces the default empty-state text (e.g. a link to a wider region).
 */
export function ServiceResults({ filters, results, counts, highlight, empty }: { filters: ServiceFilters; results: ServiceResultsData; counts: Record<ServiceSlug, number>; highlight?: string; empty?: React.ReactNode }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (!drawer) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", escape);
    document.body.classList.add("svc-drawer-open");
    return () => { document.removeEventListener("keydown", escape); document.body.classList.remove("svc-drawer-open"); };
  }, [drawer]);
  const active = filters.categories.length + (filters.city ? 1 : 0) + (filters.verified ? 1 : 0) + (filters.photos ? 1 : 0) + (filters.documented ? 1 : 0) + (filters.emergency ? 1 : 0) + (filters.q ? 1 : 0);
  // "Aramalarda görünme" in each listed firm's statistics.
  const shownIds = results.firms.map((firm) => firm.id).join(",");
  useEffect(() => { trackFirmSearch("services", results.firms); }, [shownIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = (results.page - 1) * results.perPage + 1, last = first + results.firms.length - 1, samples = results.samples || 0;
  return <div className="svc-results-layout">
    <aside className="svc-results-aside" aria-label={t("Filtreler")}><ServiceFilterForm filters={filters} counts={counts}/></aside>
    {drawer && <div className="svc-drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true"/>}
    {drawer && <div className="svc-filter-drawer" role="dialog" aria-modal="true" aria-label={t("Filtreler")}>
      <div className="svc-drawer-head"><strong>{t("Filtreler")}</strong><button type="button" onClick={() => setDrawer(false)} aria-label={t("Kapat")}><X size={22} aria-hidden="true"/></button></div>
      <ServiceFilterForm filters={filters} counts={counts} onClose={() => setDrawer(false)}/>
    </div>}

    <section className="svc-results-main" aria-labelledby="svc-results-count">
      <div className="svc-results-toolbar">
        <p id="svc-results-count" className="svc-results-count" aria-live="polite">
          <strong>{t("{n} firma").replace("{n}", number(results.total))}</strong>
          {/* The range counts positions; with samples after the real firms it would not match the real total. */}
          {samples === 0 && results.total > 0 && results.firms.length > 0 && <span>{t("{from}–{to} arası gösteriliyor").replace("{from}", number(first)).replace("{to}", number(last))}</span>}
          {samples > 0 && <span className="svc-sample-count">{t("{n} örnek firma").replace("{n}", number(samples))}</span>}
        </p>
        <button type="button" className="btn btn-secondary btn-sm svc-filter-button" onClick={() => setDrawer(true)} aria-haspopup="dialog">
          <SlidersHorizontal size={16} aria-hidden="true"/>{t("Filtreler")}{active > 0 && <b>{active}</b>}
        </button>
        <label className="svc-sort"><span>{t("Sırala")}</span>
          <select value={filters.sort} onChange={(event) => go({ ...filters, sort: event.target.value as ServiceSort, page: 1 })}>
            {(Object.keys(SORT_LABELS) as ServiceSort[]).map((sort) => <option key={sort} value={sort}>{t(SORT_LABELS[sort])}</option>)}
          </select></label>
      </div>
      {results.firms.some((firm) => firm.sample) && <ServiceSampleNote/>}
      {results.firms.length > 0
        ? <div className="service-firm-grid svc-results-grid">{results.firms.map((firm) => <ServiceFirmCard key={firm.id} firm={firm} highlight={highlight}/>)}</div>
        : <div className="service-empty">
            <span className="services-tile-icon"><SlidersHorizontal size={22} aria-hidden="true"/></span>
            <div>{empty || <>
              <p><strong>{results.total > 0 ? t("Bu sayfada firma yok.") : t("Aramanızla eşleşen firma bulunamadı.")}</strong></p>
              <p>{t("Filtreleri azaltmayı veya daha geniş bir bölge seçmeyi deneyin.")}</p>
              <Link href={results.total > 0 ? serviceSearchHref({ ...filters, page: 1 }) : serviceSearchHref({ ...EMPTY_SERVICE_FILTERS, q: filters.q })} className="btn btn-secondary btn-sm">{t(results.total > 0 ? "İlk sayfaya dön" : "Filtreleri temizle")}</Link>
            </>}</div>
          </div>}
      <Pagination filters={filters} page={results.page} pages={results.pages}/>
    </section>
  </div>;
}
