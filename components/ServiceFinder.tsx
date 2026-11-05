"use client";
import { MapPin, Search } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { SERVICE_CATEGORIES, SERVICE_GROUPS } from "@/lib/service-categories";
import { servicePath } from "@/lib/services";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

// Service + province (+ district) search. Opens the canonical page (/hizmetler/{kategori}/{il}/{ilçe})
// and keeps a shared ?lang link. Used in the landing hero and as the filter on category pages.
export function ServiceFinder({ category = "", city = "", district = "", compact = false }: { category?: string; city?: string; district?: string; compact?: boolean }) {
  const { t } = useLocale();
  const [form, setForm] = useState({ category, city, district });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.category) return;
    const target = new URL(servicePath(form.category, form.city || null, form.district || null), window.location.origin);
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (lang) target.searchParams.set("lang", lang);
    window.location.assign(target.pathname + target.search);
  }
  return <form className={compact ? "service-finder compact" : "service-finder"} onSubmit={submit} role="search" aria-label={t("Hizmet ara")}>
    <label className="service-finder-field service-finder-service"><span><Search size={15} aria-hidden="true"/>{t("Hangi hizmet?")}</span>
      <select value={form.category} aria-required="true" onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))}>
        <option value="">{t("Hizmet seçin")}</option>
        {SERVICE_GROUPS.map((group) => <optgroup key={group.id} label={t(group.name)}>{SERVICE_CATEGORIES.filter((item) => item.group === group.id).map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}</optgroup>)}
      </select></label>
    <label className="service-finder-field"><span><MapPin size={15} aria-hidden="true"/>{t("İl")}</span>
      <select value={form.city} onChange={(event) => setForm((old) => ({ ...old, city: event.target.value, district: "" }))}>
        <option value="">{t("Tüm Türkiye")}</option>
        {CITIES.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
    <label className="service-finder-field"><span>{t("İlçe")}</span>
      <select value={form.district} disabled={!form.city} onChange={(event) => setForm((old) => ({ ...old, district: event.target.value }))}>
        <option value="">{t("Tüm ilçeler")}</option>
        {districtsFor(form.city).map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
    <button type="submit" className="btn btn-accent service-finder-submit" disabled={!form.category}><Search size={17} aria-hidden="true"/>{t(compact ? "Filtrele" : "Firma bul")}</button>
  </form>;
}
