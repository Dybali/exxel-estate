"use client";
import { MapPin, Search } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { SERVICE_CATEGORIES, type ServiceSlug } from "@/lib/service-categories";
import { serviceSearchHref, withLang } from "@/lib/service-search";
import { serviceSearchKey } from "@/lib/service-text";
import { CITIES, districtsFor } from "@/lib/turkey-locations";

/** Typed text that is exactly a category name (in the visitor's language or Turkish) selects that category. */
export function categoryFromText(text: string, translate: (key: string) => string): ServiceSlug | null {
  const key = serviceSearchKey(text);
  if (!key) return null;
  const match = SERVICE_CATEGORIES.find((item) => serviceSearchKey(item.name) === key || serviceSearchKey(translate(item.name)) === key);
  return match ? match.slug : null;
}

// Landing hero search: service or firm name + province (+ district). A category name opens its
// category/region page; any other text searches firm names and descriptions on /hizmetler/ara.
export function ServiceFinder() {
  const { t } = useLocale();
  const [form, setForm] = useState({ text: "", city: "", district: "" });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = categoryFromText(form.text, t);
    const href = serviceSearchHref({ q: category ? "" : form.text.trim(), categories: category ? [category] : [], city: form.city, district: form.district });
    window.location.assign(withLang(href, new URLSearchParams(window.location.search).get("lang")));
  }
  return <form className="service-finder" onSubmit={submit} role="search" aria-label={t("Hizmet ara")}>
    <label className="service-finder-field service-finder-service"><span><Search size={15} aria-hidden="true"/>{t("Hangi hizmet?")}</span>
      <input type="search" value={form.text} list="service-finder-categories" maxLength={100} placeholder={t("Örn. boyacı, nakliyat, firma adı")} autoComplete="off" enterKeyHint="search"
        onChange={(event) => setForm((old) => ({ ...old, text: event.target.value }))}/>
      <datalist id="service-finder-categories">{SERVICE_CATEGORIES.map((item) => <option key={item.slug} value={t(item.name)}/>)}</datalist>
    </label>
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
    <button type="submit" className="btn btn-accent service-finder-submit"><Search size={17} aria-hidden="true"/>{t("Firma bul")}</button>
  </form>;
}
