"use client";
import {apiJson} from '@/lib/api-client';


import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "@/components/SafeLink";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Bookmark, Grid2X2, Map, MapPin, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { AMENITIES, CITIES, PROPERTY_TYPES, type Listing } from "@/lib/listings";
import { districtsFor } from "@/lib/turkey-locations";
import { useLocale } from "@/lib/i18n";
import {PropertyMap} from "./PropertyMap";
import {discoveryAction,type SavedSearch} from "@/lib/discovery-client";
import {CURRENCIES,priceCurrency} from "@/lib/price-filters";
import {PROPERTY_CATEGORIES,PURPOSES,purposeLabel} from "@/lib/property-categories";
import { ListingCard } from "./ListingCard";
import {DAY_OPTIONS,EXTRA_FILTERS,HEATING_OPTIONS,ROOM_OPTIONS,SEARCH_CATEGORIES,SIDEBARS,searchCategory,type ExtraFilter} from "@/lib/search-categories";
import {LAND_CREDIT,LAND_DEED,LAND_ZONING} from "@/lib/land";
import {SUBTYPES} from "@/lib/property-subtypes";

type Filters = {
  q:string; category:string; neighborhood:string; currency:string; purpose: string; city: string; district: string; type: string;
  minPrice: string; maxPrice: string; minArea: string; maxArea: string;
  bedrooms: string; bathrooms: string; furnished: boolean;
  amenities: string[];
} & Record<ExtraFilter,string>;
const emptyExtras=Object.fromEntries(EXTRA_FILTERS.map(key=>[key,""])) as Record<ExtraFilter,string>;
const emptyFilters: Filters = {
  q:"", category:"", neighborhood:"", currency:"", purpose: "", city: "", district: "", type: "", minPrice: "", maxPrice: "",
  minArea: "", maxArea: "", bedrooms: "", bathrooms: "",
  furnished: false, amenities: [], ...emptyExtras,
};
// Filters that only make sense inside one category; they are cleared when the category changes.
const CATEGORY_FILTERS:(keyof Filters)[]=["type","rooms","bedrooms","bathrooms","minNetArea","maxNetArea","minAge","maxAge","minFloor","maxFloor","minFloors","maxFloors","heating","zoning","deed","credit","businessType","tourismType"];
const DAY_LABELS:Record<string,string>={"1":"Son 24 saat","3":"Son 3 gün","7":"Son 7 gün","15":"Son 15 gün","30":"Son 30 gün"};
const FILTER_LABELS:Record<string,string>={category:"Gayrimenkul kategorileri",neighborhood:"Mahalle",purpose:"İlan türü",city:"Şehir",district:"İlçe",type:"Gayrimenkul tipi",currency:"Para birimi",minPrice:"En az",maxPrice:"En çok",minArea:"Min m²",maxArea:"Max m²",bedrooms:"En az yatak odası",bathrooms:"En az banyo",rooms:"Oda sayısı",minNetArea:"Min net m²",maxNetArea:"Max net m²",minAge:"En az bina yaşı",maxAge:"En çok bina yaşı",minFloor:"En az bulunduğu kat",maxFloor:"En çok bulunduğu kat",minFloors:"En az kat sayısı",maxFloors:"En çok kat sayısı",heating:"Isıtma",from:"Kimden",days:"İlan tarihi",video:"Videolu ilanlar",tour:"Sanal tura sahip ilanlar",mapped:"Haritalı ilanlar",zoning:"İmar Durumu",deed:"Tapu Durumu",credit:"Krediye Uygunluk",businessType:"İş yeri tipi",tourismType:"Tesis tipi"};
const filterKeys = Object.keys(emptyFilters) as (keyof Filters)[];

function readFilters(params: { get: (key: string) => string | null }): Filters {
  return {
    q:(params.get("q")||"").slice(0,160),category:params.get("category")==="devren"?"":params.get("category")||"",neighborhood:params.get("neighborhood")||"",
    currency:(()=>{try{return priceCurrency(params);}catch{return "";}})(),
    purpose: params.get("category")==="devren"?"devren":params.get("purpose") || "", city: params.get("city") || "",
    district: params.get("district") || "", type: params.get("type") || "",
    minPrice: params.get("minPrice") || "", maxPrice: params.get("maxPrice") || "",
    minArea: params.get("minArea") || "", maxArea: params.get("maxArea") || "",
    bedrooms: params.get("bedrooms") || "",
    bathrooms: params.get("bathrooms") || "", furnished: params.get("furnished") === "1",
    amenities: (params.get("amenities") || "").split(",").filter((item) => AMENITIES.includes(item)),
    ...Object.fromEntries(EXTRA_FILTERS.map(key=>[key,(params.get(key)||"").slice(0,400)])) as Record<ExtraFilter,string>,
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
function Block({ title, open = true, children }: { title: string; open?: boolean; children: ReactNode }) {
  return <details className="filter-block" open={open}><summary><h3>{title}</h3></summary><div className="filter-block-body">{children}</div></details>;
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
  const [searchError,setSearchError]=useState("");
  const [retry,setRetry]=useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [mapSelected,setMapSelected]=useState<Listing|null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveError,setSaveError]=useState("");
  const [saving,setSaving]=useState(false);
  const [boundsFilter,setBoundsFilter]=useState(()=>params.get("bounds")||"");
  const [areaFilter,setAreaFilter]=useState(()=>params.get("area")||"");
  const changeBounds=useCallback((value:string)=>{setBoundsFilter(value);if(value)setAreaFilter("");setPage(1);},[]);
  const changeArea=useCallback((value:string)=>{setAreaFilter(value);if(value)setBoundsFilter("");setPage(1);},[]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const requestedOnce = useRef(false);
  const query = useMemo(() => {const q=filterQuery(filters,sort);if(params.get('assistant')==='1'){q.set('assistant','1');if(!filters.furnished&&params.get('furnished')==='0')q.set('furnished','0');}if(boundsFilter)q.set("bounds",boundsFilter);if(areaFilter)q.set("area",areaFilter);return q.toString();}, [filters, sort,boundsFilter,areaFilter,params]);

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams(query);
    search.set("page", String(page));
    setLoading(true);setSearchError("");
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
      .catch(() => { if (!controller.signal.aborted){setLoading(false);setSearchError("İlanlar yüklenemedi. Tekrar deneyin.");} }), delay);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page,retry]);
  useEffect(() => {
    const search = new URLSearchParams(query);
    if (map) search.set("view", "map");
    const next = search.toString();
    window.history.replaceState(window.history.state, "", `/ilanlar${next ? `?${next}` : ""}`);
  }, [query, map]);
  useEffect(() => {
    const refresh=()=>fetch("/api/discovery",{cache:"no-store"}).then(r=>r.ok?apiJson<{searches?:SavedSearch[]}>(r):{searches:[]}).then(data=>setSaved(data.searches||[])).catch(()=>{});
    refresh();window.addEventListener("salesorrent:discovery-changed",refresh);return()=>window.removeEventListener("salesorrent:discovery-changed",refresh);
  }, []);
  useEffect(() => {
    if (!listings.some((item) => item.id === selectedId)&&mapSelected?.id!==selectedId) setSelectedId(listings.find((item) => item.latitude && item.longitude)?.id || null);
  }, [listings, selectedId,mapSelected]);

  useEffect(()=>setMapSelected(null),[query]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((old) => ({ ...old, [key]: value, ...(key==="city"?{district:"",neighborhood:""}:key==="district"?{neighborhood:""}:{}), ...(key==="type"&&value&&old.category&&!PROPERTY_CATEGORIES.find(item=>item.value===old.category)?.types.some(item=>item===value)?{category:""}:{}), ...((key==="minPrice"||key==="maxPrice")&&value&&!old.currency?{currency:"TRY"}:{}), ...(key==="currency"&&!value?{minPrice:"",maxPrice:""}:{}) }));
    if(key==="currency"&&!value)setSort("new");
    setBoundsFilter("");setPage(1);
  };
  const reset = () => { setFilters(emptyFilters);setBoundsFilter(""); setSort("new"); setPage(1); };
  const chipValue = (key: string, value: string) => key === "purpose" ? t(purposeLabel(value)) : key === "category" ? t(PROPERTY_CATEGORIES.find(item=>item.value===value)?.label||value) : key === "type" ? t(PROPERTY_TYPES.find((item) => item.value === value)?.label || value) : key === "from" ? t(value === "agent" ? "Emlak Ofisinden" : "Sahibinden") : key === "days" ? t(DAY_LABELS[value] || value) : ["video","tour","mapped"].includes(key) ? "" : value.split(",").map(item=>t(item)).join(", ");
  const active = [
    ...(Object.keys(FILTER_LABELS) as (keyof Filters)[])
      .filter((key) => filters[key])
      .map((key) => { const value = chipValue(key, String(filters[key])); return { key, label: value ? `${t(FILTER_LABELS[key])}: ${value}` : t(FILTER_LABELS[key]) }; }),
    ...(filters.furnished ? [{ key: "furnished", label: t("Eşyalı") }] : []),
    ...filters.amenities.map((item) => ({ key: `amenity:${item}`, label: t(item) })),
  ];
  const remove = (key: string) => {
    if (key.startsWith("amenity:")) set("amenities", filters.amenities.filter((item) => item !== key.slice(8)));
    else if (key === "furnished") set("furnished", false);
    else if (key in emptyFilters) set(key as Exclude<keyof Filters, "amenities" | "furnished">, "");
  };
  const selected = listings.find((item) => item.id === selectedId) || (mapSelected?.id===selectedId?mapSelected:null) || listings.find((item) => item.latitude && item.longitude);
  const saveSearch = async () => {
    if(saving)return;setSaving(true);setSaveError("");
    try {await discoveryAction({action:"save",name:searchName,query});setSearchName("");}
    catch(e){setSaveError((e as Error).message);}finally{setSaving(false);}
  };
  const openSaved = (item: SavedSearch) => {
    const search = new URLSearchParams(item.query);
    setFilters(readFilters(search));setBoundsFilter(search.get("bounds")||"");
    setSort(search.get("sort") || "new");
    setMap(search.get("view") === "map");
    setPage(1);
    setSaveOpen(false);
  };
  const removeSaved = async (id: string) => {try{await discoveryAction({action:"delete",id});}catch(e){setSaveError((e as Error).message);}};
  const scope = searchCategory(filters.category, filters.type), sidebar = SIDEBARS[scope] || SIDEBARS[""];
  const subtype = SUBTYPES[filters.type] || SUBTYPES[({ isyeri: "ticari", turistik: "turistik" } as Record<string, string>)[scope]];
  const typeChoices = PROPERTY_TYPES.filter(item => !scope || (PROPERTY_CATEGORIES.find(c => c.value === scope)?.types as readonly string[] | undefined)?.includes(item.value));
  const changeCategory = (category: string) => {
    const next = SIDEBARS[category] || SIDEBARS[""];
    setFilters(old => ({ ...old, ...Object.fromEntries(CATEGORY_FILTERS.map(key => [key, ""])), category, furnished: next.furnished && old.furnished, amenities: old.amenities.filter(item => next.amenities.includes(item)), purpose: !category || SEARCH_CATEGORIES[category]?.purposes.includes(old.purpose) ? old.purpose : "" }));
    setBoundsFilter(""); setPage(1);
  };
  const toggle = (key: "rooms" | "heating", value: string) => { const items = filters[key] ? filters[key].split(",") : []; set(key, (items.includes(value) ? items.filter(item => item !== value) : [...items, value]).join(",")); };
  type TextFilter = Exclude<keyof Filters, "furnished" | "amenities">;
  const range = (min: TextFilter, max: TextFilter) => <div className="filter-pair"><Field label={t("En az")}><input type="number" min="0" inputMode="numeric" placeholder="Min" value={filters[min]} onChange={(event) => set(min, event.target.value)}/></Field><Field label={t("En çok")}><input type="number" min="0" inputMode="numeric" placeholder="Max" value={filters[max]} onChange={(event) => set(max, event.target.value)}/></Field></div>;
  const choices = (name: "rooms" | "heating", options: readonly string[], label: (value: string) => string) => <div className="filter-choices">{options.map(value => <label key={value}><input type="checkbox" checked={filters[name].split(",").includes(value)} onChange={() => toggle(name, value)}/><span>{label(value)}</span></label>)}</div>;
  const searchNameSuggestion = [filters.city || t("Türkiye"), filters.purpose ? t(purposeLabel(filters.purpose)) : ""].filter(Boolean).join(" · ");

  return <main className="explore-page">
    <div className="explore-top"><div className="container"><span className="eyebrow dark-eyebrow">{t("GAYRİMENKUL KOLEKSİYONU")}</span><h1>{t("Size uygun")} <em>{t("yeri bulun.")}</em></h1><p>{t("Türkiye’nin seçkin adreslerini, aradığınız ayrıntılara göre keşfedin.")}</p><div className="explore-quick-search" role="search"><div className="explore-quick-purpose"><button type="button" className={filters.purpose === "satilik" ? "active" : ""} onClick={() => set("purpose", "satilik")}>{t("Satılık")}</button><button type="button" className={filters.purpose === "kiralik" ? "active" : ""} onClick={() => set("purpose", "kiralik")}>{t("Kiralık")}</button></div><label><span>{t("Şehir")}</span><select value={filters.city} onChange={(event) => { setFilters((old) => ({ ...old, city: event.target.value, district: "",neighborhood:"" })); setBoundsFilter("");setPage(1); }}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></label><label><span>{t("Gayrimenkul türü")}</span><select value={filters.type} onChange={(event) => set("type", event.target.value)}><option value="">{t("Tüm kategoriler")}</option>{PROPERTY_TYPES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label><button type="button" className="explore-quick-filter" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={17}/>{t("Filtreler")}</button></div></div></div>
    <div className="container explore-shell">
      <aside className={`filters ${mobileFilters ? "filters-open" : ""}`}>
        <div className="filter-head"><strong>{t("Filtreler")}</strong><button type="button" onClick={reset}><RotateCcw size={14}/>{t("Temizle")}</button><button type="button" className="filter-close" onClick={() => setMobileFilters(false)} aria-label={t("Filtreleri kapat")}><X size={20}/></button></div>
        <Block title={t("Kategori")}><Field label={t("Gayrimenkul kategorileri")}><select value={filters.category} onChange={e=>changeCategory(e.target.value)}><option value="">{t("Tümü")}</option>{PROPERTY_CATEGORIES.map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></Field><Field label={t("İlan türü")}><select value={filters.purpose} onChange={e=>set("purpose",e.target.value)}><option value="">{t("Tümü")}</option>{PURPOSES.filter(item=>!scope||SEARCH_CATEGORIES[scope].purposes.includes(item.value)).map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></Field>{typeChoices.length>1&&<Field label={t("Gayrimenkul tipi")}><select value={filters.type} onChange={e=>set("type",e.target.value)}><option value="">{t("Tümü")}</option>{typeChoices.map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></Field>}{subtype&&<Field label={t(subtype.label)}><select value={filters[subtype.field]} onChange={e=>set(subtype.field,e.target.value)}><option value="">{t("Tümü")}</option>{subtype.options.map(v=><option key={v} value={v}>{t(v)}</option>)}</select></Field>}</Block>
        <Block title={t("Adres")}><Field label={t("İl")}><select value={filters.city} onChange={(event) => { setFilters((old) => ({ ...old, city: event.target.value, district: "",neighborhood:"" })); setBoundsFilter("");setPage(1); }}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((city) => <option key={city}>{city}</option>)}</select></Field><Field label={t("İlçe")}><select value={filters.district} onChange={(event) => set("district", event.target.value)} disabled={!filters.city}><option value="">{t("Tüm ilçeler")}</option>{districtsFor(filters.city).map((district) => <option key={district} value={district}>{district}</option>)}</select></Field></Block>
        <Block title={t("Fiyat")}><div className="filter-currency" role="group" aria-label={t("Para birimi")}>{CURRENCIES.map(code=><button type="button" key={code} aria-pressed={(filters.currency||"TRY")===code} onClick={()=>set("currency",code)}>{code}</button>)}</div>{range("minPrice","maxPrice")}<p className="currency-note">{t("Fiyat filtresi ve sıralaması seçili para birimine uygulanır. Döviz çevrimi yapılmaz.")}</p></Block>
        <Block title={t(sidebar.land?"m²":"m² (Brüt)")}>{range("minArea","maxArea")}</Block>
        {(sidebar.rooms||sidebar.building)&&<Block title={t("m² (Net)")} open={Boolean(filters.minNetArea||filters.maxNetArea)}>{range("minNetArea","maxNetArea")}</Block>}
        {sidebar.land&&<Block title={t("Arsa bilgileri")}><Field label={t("İmar Durumu")}><select value={filters.zoning} onChange={e=>set("zoning",e.target.value)}><option value="">{t("Tümü")}</option>{LAND_ZONING.map(v=><option key={v} value={v}>{t(v)}</option>)}</select></Field><Field label={t("Tapu Durumu")}><select value={filters.deed} onChange={e=>set("deed",e.target.value)}><option value="">{t("Tümü")}</option>{LAND_DEED.filter(v=>v!=="Belirtilmemiş").map(v=><option key={v} value={v}>{t(v)}</option>)}</select></Field><Field label={t("Krediye Uygunluk")}><select value={filters.credit} onChange={e=>set("credit",e.target.value)}><option value="">{t("Fark etmez")}</option>{LAND_CREDIT.map(v=><option key={v} value={v}>{t(v)}</option>)}</select></Field></Block>}
        {sidebar.rooms&&<Block title={t("Oda sayısı")}>{choices("rooms",ROOM_OPTIONS,v=>v==="1+0"?`${t("Stüdyo")} (1+0)`:t(v))}<Field label={t("En az banyo")}><select value={filters.bathrooms} onChange={(event) => set("bathrooms", event.target.value)}><option value="">{t("Fark etmez")}</option>{[1, 2, 3, 4].map((count) => <option key={count}>{count}</option>)}</select></Field></Block>}
        {sidebar.building&&<Block title={t("Bina yaşı")} open={Boolean(filters.minAge||filters.maxAge)}>{range("minAge","maxAge")}</Block>}
        {sidebar.building&&sidebar.rooms&&<Block title={t("Bulunduğu kat")} open={Boolean(filters.minFloor||filters.maxFloor)}>{range("minFloor","maxFloor")}</Block>}
        {sidebar.building&&<Block title={t("Kat sayısı")} open={Boolean(filters.minFloors||filters.maxFloors)}>{range("minFloors","maxFloors")}</Block>}
        {sidebar.heating&&<Block title={t("Isıtma")} open={Boolean(filters.heating)}>{choices("heating",HEATING_OPTIONS,t)}</Block>}
        {(sidebar.furnished||sidebar.amenities.length>0)&&<Block title={t("Özellikler")} open={filters.furnished||filters.amenities.length>0}>{sidebar.furnished&&<label className="check-row"><input type="checkbox" checked={filters.furnished} onChange={(event) => set("furnished", event.target.checked)}/>{t("Eşyalı")}</label>}{sidebar.amenities.map((amenity) => <label className="check-row" key={amenity}><input type="checkbox" checked={filters.amenities.includes(amenity)} onChange={(event) => set("amenities", event.target.checked ? [...filters.amenities, amenity] : filters.amenities.filter((item) => item !== amenity))}/>{t(amenity)}</label>)}</Block>}
        {scope!=="isyeri"&&scope!=="turistik"&&scope!=="arsa"&&<Block title={t("Kimden")} open={Boolean(filters.from)}>{[["","Tümü"],["owner","Sahibinden"],["agent","Emlak Ofisinden"]].map(([value,label])=><label className="check-row" key={value}><input type="radio" name="from" checked={filters.from===value} onChange={()=>set("from",value)}/>{t(label)}</label>)}</Block>}
        <Block title={t("İlan tarihi")} open={Boolean(filters.days)}>{["",...DAY_OPTIONS].map(v=><label className="check-row" key={v}><input type="radio" name="days" checked={filters.days===v} onChange={()=>set("days",v)}/>{t(v?DAY_LABELS[v]:"Tümü")}</label>)}</Block>
        <Block title={t("Fotoğraf, Video")} open={Boolean(filters.video||filters.tour)}>{([["video","Videolu ilanlar"],["tour","Sanal tura sahip ilanlar"]] as const).map(([key,label])=><label className="check-row" key={key}><input type="checkbox" checked={filters[key]==="1"} onChange={e=>set(key,e.target.checked?"1":"")}/>{t(label)}</label>)}</Block>
        <Block title={t("Harita")} open={Boolean(filters.mapped)}><label className="check-row"><input type="checkbox" checked={filters.mapped==="1"} onChange={e=>set("mapped",e.target.checked?"1":"")}/>{t("Haritalı ilanlar")}</label></Block>
        <Block title={t("Kelime ile filtrele")}><Field label={t("Kelime")}><input type="search" maxLength={160} value={filters.q} onChange={event=>set("q",event.target.value)} placeholder={t("İlçe, mahalle veya anahtar kelime")}/></Field></Block>
        <button className="mobile-apply" onClick={() => setMobileFilters(false)}>{total} {t("ilanı göster")}<ArrowRight size={17}/></button>
      </aside>
      <section className="results" aria-busy={loading}>
        <div className="results-toolbar"><div><span className="eyebrow dark-eyebrow">{t("ARAMA SONUÇLARI")}</span><h2>{loading && page === 1 ? t("İlanlar yükleniyor...") : `${total} ${t("gayrimenkul bulundu")}`}</h2></div><div className="results-tools"><button className="filter-mobile-button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={17}/>{t("Filtreler")} {active.length > 0 && `(${active.length})`}</button><button className="save-search-button" onClick={() => { setSearchName(searchNameSuggestion); setSaveOpen(!saveOpen); }} aria-expanded={saveOpen}><Bookmark size={16}/><span>{t("Aramayı kaydet")}</span></button><select value={sort} onChange={(event) => { setSort(event.target.value);setPage(1); }} aria-label={t("Sıralama")}><option value="new">{t("Önerilen")}</option><option value="newest">{t("En yeni ilanlar")}</option><option value="priceAsc">{t("Fiyat: düşükten yükseğe")}</option><option value="priceDesc">{t("Fiyat: yüksekten düşüğe")}</option><option value="area">{t("m²: büyükten küçüğe")}</option></select><div className="view-toggle"><button className={!map ? "active" : ""} onClick={() => setMap(false)} aria-label={t("Liste görünümü")} aria-pressed={!map}><Grid2X2 size={18}/></button><button className={map ? "active" : ""} onClick={() => setMap(true)} aria-label={t("Harita görünümü")} aria-pressed={map}><Map size={18}/></button></div></div></div>
        {saveOpen && <div className="saved-search-panel"><div><div><strong>{t("Aramayı kaydet")}</strong><p>{t("Aramanız hesabınıza kaydedilir. Uygun yeni ilanlarda site içi bildirim alırsınız.")}</p></div><button className="saved-search-close" onClick={() => setSaveOpen(false)} aria-label={t("Kapat")}><X size={17}/></button></div><form onSubmit={(event) => { event.preventDefault(); saveSearch(); }}><input value={searchName} onChange={(event) => setSearchName(event.target.value)} maxLength={70} aria-label={t("Arama adı")} placeholder={t("Arama adı")} required/><button type="submit" disabled={saving}>{t(saving?"Kaydediliyor...":"Kaydet")}</button></form>{saveError&&<p role="alert">{t(saveError)}</p>}{saved.length > 0 && <div className="saved-search-list"><small>{t("KAYITLI ARAMALAR")}</small>{saved.map((item) => <div key={item.id}><button onClick={() => openSaved(item)}>{item.name}</button><button onClick={() => removeSaved(item.id)} aria-label={t("Kaydı sil")}><X size={15}/></button></div>)}</div>}</div>}
        {boundsFilter&&<div className="active-filters"><button className="clear-all" onClick={()=>changeBounds("")}>{t("Harita alanı seçili")} ×</button></div>}{areaFilter&&<div className="active-filters"><button className="clear-all" onClick={()=>changeArea("")}>{t("Çizilen alan seçili")} ×</button></div>}
        {active.length > 0 && <div className="active-filters"><div className="filter-chips">{active.map((item) => <button key={item.key} onClick={() => remove(item.key)} aria-label={`${item.label} · ${t("Kaldır")}`}>{item.label}<X size={13}/></button>)}</div><button className="clear-all" onClick={reset}>{t("Tümünü temizle")}</button></div>}
        {searchError?<div className="search-failure" role="alert"><p>{t(searchError)}</p><button className="outline-button" onClick={()=>setRetry(n=>n+1)}>{t("Yeniden dene")}</button></div>:loading&&page===1&&!map?<div className="listing-skeletons" role="status" aria-label={t("İlanlar yükleniyor...")}>{Array.from({length:6},(_,i)=><div key={i}/>)}</div>:!loading && listings.length === 0 && !map ? <div className="empty-results"><Search size={36}/><h3>{t("Bu ölçütlere uygun ilan bulunamadı.")}</h3><p>{t("Filtreleri değiştirerek yeniden deneyebilirsiniz.")}</p><button className="outline-button" onClick={reset}>{t("Filtreleri temizle")}</button></div> : map ? <div className="map-layout"><div className="map-list">{listings.map((listing) => <div className={`map-list-item ${selected?.id === listing.id ? "selected" : ""}`} key={listing.id}><ListingCard listing={listing}/>{listing.latitude && listing.longitude && <button className="map-show-button" onClick={() => setSelectedId(listing.id)}><MapPin size={14}/>{t("Haritada göster")}</button>}</div>)}</div><div className="map-panel"><PropertyMap query={query} selectedId={selectedId} onSelect={listing=>{setSelectedId(listing.id);setMapSelected(listing);}} onBounds={changeBounds} onClearBounds={()=>{changeBounds("");changeArea("");}} area={areaFilter} onArea={changeArea}/>{selected && <div className="map-property"><span>{t("HARİTADA SEÇİLİ İLAN")}</span><strong>{locale === "tr" ? selected.title : selected.translations?.[locale]?.title || selected.title}</strong><small>{selected.district}, {selected.city}</small><Link href={`/ilan/${selected.id}`}>{t("İlanı incele")}<ArrowRight size={15}/></Link></div>}<div className="map-attribution">{t("Haritadaki nokta yaklaşık konumu gösterir.")}</div></div></div> : <div className="results-grid">{listings.map((listing,index) => <ListingCard key={listing.id} listing={listing} priority={index===0}/>)}</div>}
        {total > listings.length && <div className="show-more"><button className="outline-button" disabled={loading} onClick={() => setPage((old) => old + 1)}>{loading ? t("İlanlar yükleniyor...") : t("Daha fazla ilan göster")}<ArrowRight size={16}/></button></div>}
      </section>
    </div>
  </main>;
}
