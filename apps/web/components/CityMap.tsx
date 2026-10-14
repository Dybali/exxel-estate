"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, MapPinned, Search } from "lucide-react";
import { CITIES } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

type Point = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Point[][] | Point[][][] };
type GeoFeature = { properties: { il_adi: string }; geometry: Geometry };
type GeoData = { features: GeoFeature[] };
type Shape = { name: string; path: string; cx: number; cy: number };

const normalize = (value: string) => value.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
const officialCity = (value: string) => CITIES.find((city) => normalize(city) === normalize(value)) || value;
const project = ([lon, lat]: Point): Point => [18 + (lon - 25.665) * 47.2, 21 + (42.105 - lat) * 55.5];

function toShapes(data: GeoData): Shape[] {
  return data.features.map((feature) => {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Point[][]] : feature.geometry.coordinates as Point[][][];
    const points = polygons.flat(2).map(project);
    const xs = points.map((item) => item[0]), ys = points.map((item) => item[1]);
    const path = polygons.map((polygon) => polygon.map((ring) => ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z").join(" ")).join(" ");
    return { name: officialCity(feature.properties.il_adi), path, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
  });
}

export function CityMap() {
  const { t, locale } = useLocale();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState("İstanbul");
  const [search, setSearch] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/turkiye-iller.geojson", { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error("map"); return response.json() as Promise<GeoData>; }),
      fetch("/api/city-counts", { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error("count"); return response.json() as Promise<{ cities: { city: string; count: number }[] }>; }),
    ]).then(([geo, stats]) => {
      setShapes(toShapes(geo));
      setCounts(Object.fromEntries(stats.cities.map((item) => [normalize(item.city), item.count])));
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  const countFor = (city: string) => counts?.[normalize(city)] || 0;
  const cityList = useMemo(() => CITIES.filter((city) => normalize(city).includes(normalize(search))).sort((a, b) => countFor(b) - countFor(a) || a.localeCompare(b, "tr")).slice(0, search ? 81 : 8), [search, counts]);
  const selectedCount = countFor(selected);
  return <div className="city-map-layout">
    <div className="city-map-canvas">
      {shapes.length ? <svg viewBox="0 0 960 410" role="img" aria-label={t("Türkiye illeri haritası ve ilan sayıları")}>
        <g>{shapes.map((shape) => {
          const count = countFor(shape.name);
          return <path key={shape.name} d={shape.path} fillRule="evenodd" className={`city-map-province${selected === shape.name ? " selected" : count ? " has-listings" : ""}`} role="button" tabIndex={0} aria-label={`${shape.name}: ${count} ${t("ilan")}`} onClick={() => setSelected(shape.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(shape.name); } }}><title>{shape.name}: {count} {t("ilan")}</title></path>;
        })}</g>
        {shapes.filter((shape) => countFor(shape.name) > 0).slice(0, 20).map((shape) => <g key={`${shape.name}-label`} className="city-map-pin" transform={`translate(${shape.cx} ${shape.cy})`} onClick={() => setSelected(shape.name)} role="button" tabIndex={0} aria-label={`${shape.name}: ${countFor(shape.name)} ${t("ilan")}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(shape.name); } }}><circle r="15"/><text textAnchor="middle" dy="4">{countFor(shape.name)}</text></g>)}
      </svg> : <div className="city-map-loading"><MapPinned size={32}/>{t(failed ? "Harita şu anda yüklenemedi." : "Harita yükleniyor...")}</div>}
      <span className="city-map-attribution">{t("Harita verisi")}: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap katkıcıları</a> · ODbL</span>
    </div>
    <aside className="city-map-side">
      <span className="market-overline">{t("İl bazında arama")}</span>
      <h3>{t("Şehrinizi seçin")}</h3>
      <p>{t("Haritadaki bir ile tıklayın veya listeden seçim yapın. Sayılar yalnızca yayındaki gerçek ilanları gösterir.")}</p>
      <label className="city-map-search"><Search size={17}/><input aria-label={t("Şehir ara")} placeholder={t("Şehir ara")} value={search} onChange={(event) => setSearch(event.target.value)}/></label>
      <div className="city-map-list">{cityList.map((city) => <button key={city} type="button" className={selected === city ? "active" : ""} onClick={() => setSelected(city)}><span>{city}</span><strong>{counts ? new Intl.NumberFormat(locale).format(countFor(city)) : "—"}</strong></button>)}</div>
      <div className="city-map-selected"><span>{selected}</span><strong>{counts ? new Intl.NumberFormat(locale).format(selectedCount) : "—"} {t("yayındaki ilan")}</strong><Link href={`/ilanlar?city=${encodeURIComponent(selected)}`}>{t("İlanları gör")} <ArrowRight size={17}/></Link></div>
    </aside>
  </div>;
}
