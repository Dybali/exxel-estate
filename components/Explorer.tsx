"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "@/components/SafeLink";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Bookmark, Grid2X2, Map, MapPin, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { AMENITIES, CITIES, PROPERTY_TYPES, type Listing } from "@/lib/listings";
import { districtsFor } from "@/lib/turkey-locations";
import { useLocale } from "@/lib/i18n";
import { ListingCard } from "./ListingCard";

type Filters = {
  purpose: string; city: string; district: string; type: string;
  minPrice: string; maxPrice: string; minArea: string; maxArea: string;
  rooms: string; bedrooms: string; bathrooms: string; furnished: boolean;
  amenities: string[];
};
type SavedSearch = { id: string; name: string; query: string };
const emptyFilters: Filters = {
  purpose: "", city: "", district: "", type: "", minPrice: "", maxPrice: "",
  minArea: "", maxArea: "", rooms: "", bedrooms: "", bathrooms: "",
  furnished: false, amenities: [],
};
const filterKeys = Object.keys(emptyFilters) as (keyof Filters)[];
const cityBounds: Record<string, [number, number, number, number]> = {
  "İstanbul": [28.7, 40.8, 29.4, 41.3], "İzmir": [26.1, 37.9, 27.4, 38.8],
  "Muğla": [26.8, 36.5, 29.7, 37.6], "Antalya": [29, 35.9, 32.6, 37.4],
  "Ankara": [32.3, 39.5, 33.4, 40.3], "Bursa": [28.4, 39.9, 29.8, 40.5],
  "Aydın": [27, 37.3, 28.5, 38.2],
};

function readFilters(params: { get: (key: string) => string | null }): Filters {
  return {
    purpose: params.get("purpose") || "", city: params.get("city") || "",
    district: params.get("district") || "", type: params.get("type") || "",
    minPrice: params.get("minPrice") || "", maxPrice: params.get("maxPrice") || "",
    minArea: params.get("minArea") || "", maxArea: params.get("maxArea") || "",
    rooms: params.get("rooms") || "", bedrooms: params.get("bedrooms") || "",
    bathrooms: params.get("bathrooms") || "", furnished: params.get("furnished") === "1",
    amenities: (params.get("amenities") || "").split(",").filter((item) => AMENITIES.includes(item)),
  };
}
function filterQuery(filters: Filters, sort: string) {
  const query = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (key === "amenities") { if (filters.amenities.length) query.set(key, filters.amenities.join(",")); }
    else if (key === "furnished") { if (filters.furnished) query.set(key, "1"); }
    else if (value) query.set(key, String(value));
  }
  if (sort !== "new") query.set("sort", sort);
  return query;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="filter-field"><span>{label}</span>{children}</label>;
}

export function Explorer() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(params));
  const [sort, setSort] = useState(() => params.get("sort") || "new");
  const [map, setMap] = useState(() => params.get("view") === "map");
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const requestedOnce = useRef(false);
  const query = useMemo(() => filterQuery(filters, sort).toString(), [filters, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams(query);
    search.set("page", String(page));
    setLoading(true);
    const delay = requestedOnce.current && page === 1 ? 250 : 0;
    requestedOnce.current = true;
    const timer = window.setTimeout(() => fetch(`/api/listings?${search}`, { signal: controller.signal })
      .then(async (response): Promise<{ listings: Listing[]; total: number }> => {
        if (!response.ok) throw new Error("Search failed");
        return response.json();
      })
      .then((data) => {
        setListings((old) => page === 1 ? data.listings : [...old, ...data.listings.filter((item) => !old.some((existing) => existing.id === item.id))]);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) setLoading(false); }), delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page]);
  useEffect(() => {
    const search = new URLSearchParams(query);
    if (map) search.set("view", "map");
    const next = search.toString();
    window.history.replaceState(window.history.state, "", `/ilanlar${next ? `?${next}` : ""}`);
  }, [query, map]);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("exxel_saved_searches") || "[]");
      if (Array.isArray(stored)) setSaved(stored.filter((item) => item && typeof item.id === "string" && typeof item.query === "string" && typeof item.name === "string").slice(0, 10));
    } catch { /* Ignore malformed local preferences. */ }
  }, []);
  useEffect(() => {
    if (!listings.some((item) => item.id === selectedId)) setSelectedId(listings.find((item) => item.latitude && item.longitude)?.id || null);
  }, [listings, selectedId]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(1);
  };
  const reset = () => { setFilters(emptyFilters); setSort("new"); setPage(1); };
  const active = [
    ...(["purpose", "city", "district", "type", "minPrice", "maxPrice", "minArea", "maxArea", "rooms", "bedrooms", "bathrooms"] as const)
      .filter((key) => filters[key])
      .map((key) => ({ key, label: `${t(({ purpose: "İlan türü", city: "Şehir", district: "İlçe", type: "Kategori", minPrice: "En az ₺", maxPrice: "En çok ₺", minArea: "Min m²", maxArea: "Max m²", rooms: "Oda düzeni", bedrooms: "En az yatak odası", bathrooms: "En az banyo" })[key])}: ${key === "purpose" ? t(filters[key] === "satilik" ? "Satılık" : "Kiralık") : key === "type" ? t(PROPERTY_TYPES.find((item) => item.value === filters[key])?.label || filters[key]) : filters[key]}` })),
    ...(filters.furnished ? [{ key: "furnished", label: t("Eşyalı") }] : []),
    ...filters.amenities.map((item) => ({ key: `amenity:${item}`, label: t(item) })),
  ];
  const remove = (key: string) => {
    if (key.startsWith("amenity:")) set("amenities", filters.amenities.filter((item) => item !== key.slice(8)));
    else if (key === "furnished") set("furnished", false);
    else if (key in emptyFilters) set(key as Exclude<keyof Filters, "amenities" | "furnished">, "");
  };
  const selected = listings.find((item) => item.id === selectedId) || listings.find((item) => item.latitude && item.longitude);
  const bounds = selected?.latitude && selected?.longitude
    ? [selected.longitude - .017, selected.latitude - .012, selected.longitude + .017, selected.latitude + .012]
    : cityBounds[filters.city] || [25.5, 35.6, 45, 42.5];
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.join("%2C")}&layer=mapnik${selected?.latitude && selected?.longitude ? `&marker=${selected.latitude}%2C${selected.longitude}` : ""}`;
  const saveSearch = () => {
    const name = searchName.trim().slice(0, 70);
    if (!name) return;
    const savedQuery = new URLSearchParams(query);
    if (map) savedQuery.set("view", "map");
    const next = [{ id: crypto.randomUUID(), name, query: savedQuery.toString() }, ...saved.filter((item) => item.query !== savedQuery.toString())].slice(0, 10);
    setSaved(next);
    window.localStorage.setItem("exxel_saved_searches", JSON.stringify(next));
    setSearchName("");
    setSaveOpen(false);
  };
  const openSaved = (item: SavedSearch) => {
    const search = new URLSearchParams(item.query);
    setFilters(readFilters(search));
    setSort(search.get("sort") || "new");
    setMap(search.get("view") === "map");
    setPage(1);
    setSaveOpen(false);
  };
  const removeSaved = (id: string) => {
    const next = saved.filter((item) => item.id !== id);
    setSaved(next);
    window.localStorage.setItem("exxel_saved_searches", JSON.stringify(next));
  };
  const searchNameSuggestion = [filters.city || t("Türkiye"), filters.purpose ? t(filters.purpose === "satilik" ? "Satılık" : "Kiralık") : ""].filter(Boolean).join(" · ");

  return <main className="explore-page">
    <div className="explore-top"><div className="container"><span className="eyebrow dark-eyebrow">{t("GAYRİMENKUL KOLEKSİYONU")}</span><h1>{t("Size uygun")} <em>{t("yeri bulun.")}</em></h1><p>{t("Türkiye’nin seçkin adreslerini, aradığınız ayrıntılara göre keşfedin.")}</p><div className="explore-quick-search" role="search"><div className="explore-quick-purpose"><button type="button" className={filters.purpose === "satilik" ? "active" : ""} onClick={() => set("purpose", "satilik")}>{t("Satılık")}</button><button type="button" className={filters.purpose === "kiralik" ? "active" : ""} onClick={() => set("purpose", "kiralik")}>{t("Kiralık")}</button></div><label><span>{t("Şehir")}</span><select value={filters.city} onChange={(event) => { setFilters((old) => ({ ...old, city: event.target.value, district: "" })); setPage(1); }}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></label><label><span>{t("Gayrimenkul türü")}</span><select value={filters.type} onChange={(event) => set("type", event.target.value)}><option value="">{t("Tüm kategoriler")}</option>{PROPERTY_TYPES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label><button type="button" className="explore-quick-filter" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={17}/>{t("Filtreler")}</button></div></div></div>
    <div className="container explore-shell">
      <aside className={`filters ${mobileFilters ? "filters-open" : ""}`}>
        <div className="filter-head"><strong>{t("Filtreler")}</strong><button type="button" onClick={reset}><RotateCcw size={14}/>{t("Temizle")}</button><button type="button" className="filter-close" onClick={() => setMobileFilters(false)} aria-label={t("Filtreleri kapat")}><X size={20}/></button></div>
        <div className="filter-block"><h3>{t("İlan türü")}</h3><div className="segmented"><button className={!filters.purpose ? "selected" : ""} onClick={() => set("purpose", "")}>{t("Tümü")}</button><button className={filters.purpose === "satilik" ? "selected" : ""} onClick={() => set("purpose", "satilik")}>{t("Satılık")}</button><button className={filters.purpose === "kiralik" ? "selected" : ""} onClick={() => set("purpose", "kiralik")}>{t("Kiralık")}</button></div></div>
        <div className="filter-block"><h3>{t("Konum")}</h3><Field label={t("Şehir")}><select value={filters.city} onChange={(event) => { setFilters((old) => ({ ...old, city: event.target.value, district: "" })); setPage(1); }}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></Field><Field label={t("İlçe")}><select value={filters.district} onChange={(event) => set("district", event.target.value)} disabled={!filters.city}><option value="">{t("Tüm ilçeler")}</option>{districtsFor(filters.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></Field></div>
        <div className="filter-block"><h3>{t("Gayrimenkul türü")}</h3><Field label={t("Kategori")}><select value={filters.type} onChange={(event) => set("type", event.target.value)}><option value="">{t("Tüm kategoriler")}</option>{PROPERTY_TYPES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></Field></div>
        <div className="filter-block"><h3>{t("Fiyat aralığı")}</h3><div className="filter-pair"><Field label={t("En az ₺")}><input type="number" min="0" placeholder="Min" value={filters.minPrice} onChange={(event) => set("minPrice", event.target.value)}/></Field><Field label={t("En çok ₺")}><input type="number" min="0" placeholder="Max" value={filters.maxPrice} onChange={(event) => set("maxPrice", event.target.value)}/></Field></div></div>
        <div className="filter-block"><h3>{t("Alan ve oda")}</h3><div className="filter-pair"><Field label={t("Min m²")}><input type="number" min="0" placeholder="m²" value={filters.minArea} onChange={(event) => set("minArea", event.target.value)}/></Field><Field label={t("Max m²")}><input type="number" min="0" placeholder="m²" value={filters.maxArea} onChange={(event) => set("maxArea", event.target.value)}/></Field></div><Field label={t("Oda düzeni")}><select value={filters.rooms} onChange={(event) => set("rooms", event.target.value)}><option value="">{t("Tümü")}</option>{["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1"].map((room) => <option key={room}>{room}</option>)}</select></Field><div className="filter-pair"><Field label={t("En az yatak odası")}><select value={filters.bedrooms} onChange={(event) => set("bedrooms", event.target.value)}><option value="">{t("Fark etmez")}</option>{[1, 2, 3, 4, 5].map((count) => <option key={count}>{count}</option>)}</select></Field><Field label={t("En az banyo")}><select value={filters.bathrooms} onChange={(event) => set("bathrooms", event.target.value)}><option value="">{t("Fark etmez")}</option>{[1, 2, 3, 4].map((count) => <option key={count}>{count}</option>)}</select></Field></div></div>
        <div className="filter-block"><h3>{t("Özellikler")}</h3><label className="check-row"><input type="checkbox" checked={filters.furnished} onChange={(event) => set("furnished", event.target.checked)}/>{t("Eşyalı")}</label>{AMENITIES.map((amenity) => <label className="check-row" key={amenity}><input type="checkbox" checked={filters.amenities.includes(amenity)} onChange={(event) => set("amenities", event.target.checked ? [...filters.amenities, amenity] : filters.amenities.filter((item) => item !== amenity))}/>{t(amenity)}</label>)}</div>
        <button className="mobile-apply" onClick={() => setMobileFilters(false)}>{total} {t("ilanı göster")}<ArrowRight size={17}/></button>
      </aside>
      <section className="results" aria-busy={loading}>
        <div className="results-toolbar"><div><span className="eyebrow dark-eyebrow">{t("ARAMA SONUÇLARI")}</span><h2>{loading && page === 1 ? t("İlanlar yükleniyor...") : `${total} ${t("gayrimenkul bulundu")}`}</h2></div><div className="results-tools"><button className="filter-mobile-button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={17}/>{t("Filtreler")} {active.length > 0 && `(${active.length})`}</button><button className="save-search-button" onClick={() => { setSearchName(searchNameSuggestion); setSaveOpen(!saveOpen); }} aria-expanded={saveOpen}><Bookmark size={16}/><span>{t("Aramayı kaydet")}</span></button><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label={t("Sıralama")}><option value="new">{t("Önerilen")}</option><option value="priceAsc">{t("Fiyat: düşükten yükseğe")}</option><option value="priceDesc">{t("Fiyat: yüksekten düşüğe")}</option><option value="area">{t("m²: büyükten küçüğe")}</option></select><div className="view-toggle"><button className={!map ? "active" : ""} onClick={() => setMap(false)} aria-label={t("Liste görünümü")} aria-pressed={!map}><Grid2X2 size={18}/></button><button className={map ? "active" : ""} onClick={() => setMap(true)} aria-label={t("Harita görünümü")} aria-pressed={map}><Map size={18}/></button></div></div></div>
        {saveOpen && <div className="saved-search-panel"><div><div><strong>{t("Aramayı kaydet")}</strong><p>{t("Kayıtlı aramalar bu tarayıcıda saklanır.")}</p></div><button className="saved-search-close" onClick={() => setSaveOpen(false)} aria-label={t("Kapat")}><X size={17}/></button></div><form onSubmit={(event) => { event.preventDefault(); saveSearch(); }}><input value={searchName} onChange={(event) => setSearchName(event.target.value)} maxLength={70} aria-label={t("Arama adı")} placeholder={t("Arama adı")} required/><button type="submit">{t("Kaydet")}</button></form>{saved.length > 0 && <div className="saved-search-list"><small>{t("KAYITLI ARAMALAR")}</small>{saved.map((item) => <div key={item.id}><button onClick={() => openSaved(item)}>{item.name}</button><button onClick={() => removeSaved(item.id)} aria-label={t("Kaydı sil")}><X size={15}/></button></div>)}</div>}</div>}
        {active.length > 0 && <div className="active-filters"><div className="filter-chips">{active.map((item) => <button key={item.key} onClick={() => remove(item.key)} aria-label={`${item.label} · ${t("Kaldır")}`}>{item.label}<X size={13}/></button>)}</div><button className="clear-all" onClick={reset}>{t("Tümünü temizle")}</button></div>}
        {!loading && listings.length === 0 ? <div className="empty-results"><Search size={36}/><h3>{t("Bu ölçütlere uygun ilan bulunamadı.")}</h3><p>{t("Filtreleri değiştirerek yeniden deneyebilirsiniz.")}</p><button className="outline-button" onClick={reset}>{t("Filtreleri temizle")}</button></div> : map ? <div className="map-layout"><div className="map-list">{listings.map((listing) => <div className={`map-list-item ${selected?.id === listing.id ? "selected" : ""}`} key={listing.id}><ListingCard listing={listing}/>{listing.latitude && listing.longitude && <button className="map-show-button" onClick={() => setSelectedId(listing.id)}><MapPin size={14}/>{t("Haritada göster")}</button>}</div>)}</div><div className="map-panel"><iframe title={t("Türkiye gayrimenkul haritası")} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>{selected && <div className="map-property"><span>{t("HARİTADA SEÇİLİ İLAN")}</span><strong>{locale === "tr" ? selected.title : selected.translations?.[locale]?.title || selected.title}</strong><small>{selected.district}, {selected.city}</small><Link href={`/ilan/${selected.id}`}>{t("İlanı incele")}<ArrowRight size={15}/></Link></div>}<div className="map-attribution">{t("Haritadaki nokta yaklaşık konumu gösterir.")}</div></div></div> : <div className="results-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div>}
        {total > listings.length && <div className="show-more"><button className="outline-button" disabled={loading} onClick={() => setPage((old) => old + 1)}>{loading ? t("İlanlar yükleniyor...") : t("Daha fazla ilan göster")}<ArrowRight size={16}/></button></div>}
      </section>
    </div>
  </main>;
}
