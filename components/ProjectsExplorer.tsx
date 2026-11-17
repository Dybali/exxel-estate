"use client";
import { ViewerGate } from "@/components/ViewerGate";
import { ForwardArrow } from "@/components/DirectionalArrow";
import {useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "@/components/SafeLink";
import {Building2, HardHat} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {CITIES} from "@/lib/turkey-locations";
import {ROOM_OPTIONS} from "@/lib/search-categories";
import {PROJECT_CURRENCIES, PROJECT_STATUSES, PROJECT_STATUS_LABELS, type Project} from "@/lib/projects";
import {ProjectCard} from "./ProjectCard";

type Filters = {city: string; status: string; rooms: string; maxPrice: string; currency: string};
const EMPTY: Filters = {city: "", status: "", rooms: "", maxPrice: "", currency: "TRY"};

// Public list of approved housing projects with city, status, room and price filters.
export function ProjectsExplorer() {
  const {t} = useLocale();
  const params = useSearchParams();
  const initial: Filters = {city: params.get("city") || "", status: params.get("status") || "", rooms: params.get("rooms") || "", maxPrice: params.get("maxPrice") || "", currency: params.get("currency") || "TRY"};
  const [draft, setDraft] = useState<Filters>(initial);
  const [filters, setFilters] = useState<Filters>(initial);
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [data, setData] = useState<{projects: Project[]; total: number; pageSize: number} | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && !(key === "currency" && (value === "TRY" || !filters.maxPrice))) query.set(key, value);
    if (page > 1) query.set("page", String(page));
    history.replaceState(null, "", `/projeler${query.toString() ? `?${query}` : ""}`);
    setFailed(false);
    fetch(`/api/projects?${query}`, {signal: controller.signal})
      .then(async (response) => { if (!response.ok) throw new Error(); return apiJson<{projects: Project[]; total: number; pageSize: number}>(response); })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [filters, page]);

  const set = (key: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((old) => ({...old, [key]: event.target.value}));
  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 12)));
  return <main className="directory-page projects-page"><div className="container">
    <div className="directory-heading"><span className="market-overline">ESTATEMARKET24 / {t("Projeler")}</span><h1>{t("Konut projeleri")}</h1><p>{t("Onaylı inşaat firmalarının ve emlak ofislerinin yeni konut projelerini inceleyin, size uygun daire tipi için yer ayırtma talebi gönderin.")}</p></div>
    <form className="project-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters(draft); }}>
      <label>{t("Şehir")}<select value={draft.city} onChange={set("city")}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
      <label>{t("Proje durumu")}<select value={draft.status} onChange={set("status")}><option value="">{t("Tümü")}</option>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{t(PROJECT_STATUS_LABELS[status])}</option>)}</select></label>
      <label>{t("Oda sayısı")}<select value={draft.rooms} onChange={set("rooms")}><option value="">{t("Tümü")}</option>{ROOM_OPTIONS.map((rooms) => <option key={rooms} value={rooms}>{rooms === "1+0" ? `${t("Stüdyo")} (1+0)` : t(rooms)}</option>)}</select></label>
      <label>{t("En yüksek fiyat")}<span className="project-filter-price"><input inputMode="numeric" pattern="\d*" maxLength={13} value={draft.maxPrice} onChange={set("maxPrice")} placeholder={t("Örn. 10000000")}/><select aria-label={t("Para birimi")} value={draft.currency} onChange={set("currency")}>{PROJECT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></span></label>
      <div className="project-filter-actions"><button type="submit" className="small-primary">{t("Filtrele")}</button><button type="button" className="outline-button" onClick={() => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); }}>{t("Temizle")}</button></div>
    </form>
    {failed ? <p className="directory-state">{t("Projeler şu anda yüklenemedi.")}</p> : !data ? <p className="directory-state">{t("Projeler yükleniyor...")}</p> : data.projects.length ? <>
      <div className="directory-count">{t("{n} proje").replace("{n}", String(data.total))}</div>
      <div className="project-grid">{data.projects.map((project) => <ProjectCard key={project.id} project={project}/>)}</div>
      {pages > 1 && <div className="directory-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Önceki")}</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Sonraki")}</button></div>}
    </> : <div className="company-empty project-empty"><Building2 size={28}/><strong>{t("Bu filtrelere uygun proje bulunamadı.")}</strong><p>{t("Onaylanan projeler burada listelenir.")}</p><button type="button" className="outline-button" onClick={() => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); }}>{t("Filtreleri temizle")}</button></div>}
    <ViewerGate action="projectSales"><div className="company-enroll"><div><strong><HardHat size={18}/> {t("Projenizi yayınlayın")}</strong><p>{t("Onaylı inşaat firmaları ve emlak ofisleri projelerini hesaplarındaki Projelerim bölümünden ekleyebilir.")}</p></div><Link className="outline-button" href="/hesabim?tab=projelerim">{t("Proje ekle")}<ForwardArrow/></Link></div></ViewerGate>
  </div></main>;
}
