"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, ChartLine, Info, MapPinned, Search } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { DisplayMoney } from "@/components/DisplayCurrency";
import { EVDS_SOURCE_URL, type MarketView, type ProvinceFigures } from "@/lib/market-stats";

// /emlak-piyasasi: TCMB housing prices and rents by province on the Türkiye map (lib/market-stats.ts).
type Shape = { name: string; path: string; cx: number; cy: number };
type Metric = "price" | "rent" | "grossYield" | "priceChange";
const METRICS: { key: Metric; label: string }[] = [
  { key: "price", label: "m² satış fiyatı" },
  { key: "rent", label: "m² kira" },
  { key: "grossYield", label: "Brüt kira getirisi" },
  { key: "priceChange", label: "Yıllık değişim" },
];
// Table columns; clicking one also colours the map by it.
const COLUMNS: { key: Metric; label: string }[] = [
  { key: "price", label: "m² satış fiyatı" },
  { key: "priceChange", label: "Yıllık değişim" },
  { key: "rent", label: "m² kira (aylık)" },
  { key: "grossYield", label: "Brüt kira getirisi" },
];
// Light yellow-green to deep green (like the big portals' market maps), on a sea-blue background.
const COLORS = ["#eef3d6", "#d3e7b0", "#a8d38f", "#72b673", "#3f925c", "#1c6b48"];
const normalize = (value: string) => value.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

function periodLabel(period: string | null, locale: string) {
  if (!period) return "";
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `${quarter[1]} / Q${quarter[2]}`;
  const month = period.match(/^(\d{4})-(\d{2})$/);
  return month ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(+month[1], +month[2] - 1, 1))) : period;
}

function Trend({ points, locale }: { points: [string, number][]; locale: string }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point[1]), min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (index: number) => 8 + index * (304 / (points.length - 1)), y = (value: number) => 92 - ((value - min) / span) * 80;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point[1]).toFixed(1)}`).join("");
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return <svg className="market-trend" viewBox="0 0 320 112" role="img" aria-label={`${points[0][0]} – ${points[points.length - 1][0]}`}>
    <path d={`${line}L${x(points.length - 1)} 100L8 100Z`} className="market-trend-area"/>
    <path d={line} className="market-trend-line"/>
    <text x="8" y="110">{points[0][0].replace("-", " ")}</text><text x="312" y="110" textAnchor="end">{points[points.length - 1][0].replace("-", " ")}</text>
    <text x="312" y="12" textAnchor="end">{compact.format(max)} ₺</text>
  </svg>;
}

export function MarketMap({ view }: { view: MarketView }) {
  const { t, locale } = useLocale();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<Metric>("price");
  const [selected, setSelected] = useState("İstanbul");
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/turkiye-map-shapes.json", { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error("map"); return response.json() as Promise<Shape[]>; })
      .then((list) => setShapes(list.map((shape) => ({ ...shape, name: view.provinces.find((item) => normalize(item.name) === normalize(shape.name))?.name || shape.name }))))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [view]);

  const byName = useMemo(() => new Map(view.provinces.map((item) => [item.name, item])), [view]);
  const valueOf = (item: ProvinceFigures | undefined) => item ? item[metric] : null;
  // Six equal-count classes, so the colours stay readable even with İstanbul and Muğla far above the rest.
  const breaks = useMemo(() => {
    const values = view.provinces.map((item) => item[metric]).filter((value): value is number => value != null).sort((a, b) => a - b);
    return values.length ? [1, 2, 3, 4, 5].map((step) => values[Math.floor((values.length * step) / 6)]) : [];
  }, [view, metric]);
  const colorOf = (value: number | null) => value == null ? "#ece9e1" : COLORS[breaks.filter((limit) => value >= limit).length];
  const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  const compact = (value: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const percent = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${number(value, 1)} %`;
  const shortValue = (value: number | null) => {
    if (value == null) return "—";
    if (metric === "grossYield" || metric === "priceChange") return metric === "priceChange" ? percent(value) : `${number(value, 1)} %`;
    return `${compact(value)} ₺`;
  };
  const labelled = useMemo(() => new Set([...view.provinces].filter((item) => item[metric] != null).sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 14).map((item) => item.name).concat(selected)), [view, metric, selected]);
  const current = byName.get(selected) || view.turkey;
  const rows = useMemo(() => view.provinces.filter((item) => normalize(item.name).includes(normalize(search)))
    .sort((a, b) => ((sortDesc ? -1 : 1) * (((a[metric] ?? -Infinity) as number) - ((b[metric] ?? -Infinity) as number))) || a.name.localeCompare(b.name, "tr")), [view, search, metric, sortDesc]);
  const metricLabel = METRICS.find((item) => item.key === metric)!.label;

  return <>
    <section className="market-cards" aria-label={t("Türkiye geneli")}>
      <article><span>{t("m² satış fiyatı")}</span><strong>{view.turkey.price != null ? <DisplayMoney value={view.turkey.price} currency="TRY"/> : "—"}</strong><small>{t("Türkiye")} · {periodLabel(view.turkey.period, locale)}</small></article>
      <article><span>{t("Yıllık değişim")}</span><strong className={view.turkey.priceChange != null && view.turkey.priceChange < 0 ? "down" : "up"}>{percent(view.turkey.priceChange)}</strong><small>{t("m² fiyatı, son 4 çeyrek")}</small></article>
      <article><span>{t("m² kira (aylık)")}</span><strong>{view.turkey.rent != null ? <DisplayMoney value={view.turkey.rent} currency="TRY"/> : "—"}</strong><small>{t("Yıllık değişim")}: {percent(view.turkey.rentChange)}</small></article>
      <article><span>{t("Brüt kira getirisi")}</span><strong>{view.turkey.grossYield != null ? `${number(view.turkey.grossYield, 1)} %` : "—"}</strong><small>{view.turkey.paybackYears != null ? t("Amortisman: {n} yıl").replace("{n}", number(view.turkey.paybackYears, 1)) : ""}</small></article>
      <article><span>{t("Konut fiyat endeksi")}</span><strong className={view.turkey.indexChange != null && view.turkey.indexChange < 0 ? "down" : "up"}>{percent(view.turkey.indexChange)}</strong><small>{t("Yıllık")} · {periodLabel(view.indexPeriod, locale)}</small></article>
    </section>

    <section className="market-map-card">
      <div className="market-metric-tabs" role="tablist" aria-label={t("Haritada gösterilen")}>{METRICS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={metric === item.key} className={metric === item.key ? "active" : ""} onClick={() => setMetric(item.key)}>{t(item.label)}</button>)}</div>
      <div className="market-map-layout">
        <div className="market-map-canvas">
          {shapes.length ? <svg viewBox="0 0 960 410" role="img" aria-label={`${t("Türkiye illeri haritası")}: ${t(metricLabel)}`}>
            <g>{shapes.map((shape) => {
              const item = byName.get(shape.name), value = valueOf(item);
              const pick = () => setSelected(shape.name);
              return <path key={shape.name} d={shape.path} fillRule="evenodd" fill={colorOf(value)} className={`market-province${selected === shape.name ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`${shape.name}: ${shortValue(value)}`} onClick={pick} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } }}><title>{shape.name}: {shortValue(value)}</title></path>;
            })}</g>
            {shapes.filter((shape) => labelled.has(shape.name)).map((shape) => <g key={`${shape.name}-label`} className={`market-label${selected === shape.name ? " selected" : ""}`} transform={`translate(${shape.cx} ${shape.cy})`} aria-hidden="true">
              <rect x="-27" y="-9" width="54" height="17" rx="8.5"/><text textAnchor="middle" dy="3.5">{shortValue(valueOf(byName.get(shape.name)))}</text>
            </g>)}
          </svg> : <div className="city-map-loading"><MapPinned size={32}/>{t(failed ? "Harita şu anda yüklenemedi." : "Harita yükleniyor...")}</div>}
          <div className="market-legend" aria-hidden="true"><span>{t("Düşük")}</span>{COLORS.map((color) => <i key={color} style={{ background: color }}/>)}<span>{t("Yüksek")}</span></div>
          <span className="city-map-attribution">{t("Harita verisi")}: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t("OpenStreetMap katkıcıları")}</a> · ODbL</span>
        </div>
        <aside className="market-detail" aria-live="polite">
          <span className="market-overline">{periodLabel(current.period, locale)}</span>
          <h2>{current.name}</h2>
          <dl>
            <div><dt>{t("m² satış fiyatı")}</dt><dd>{current.price != null ? <DisplayMoney value={current.price} currency="TRY"/> : "—"}</dd></div>
            <div><dt>{t("Yıllık değişim")}</dt><dd className={current.priceChange != null && current.priceChange < 0 ? "down" : "up"}>{percent(current.priceChange)}</dd></div>
            <div><dt>{t("m² kira (aylık)")}</dt><dd>{current.rent != null ? <DisplayMoney value={current.rent} currency="TRY"/> : "—"}</dd></div>
            <div><dt>{t("Brüt kira getirisi")}</dt><dd>{current.grossYield != null ? `${number(current.grossYield, 1)} %` : "—"}</dd></div>
            <div><dt>{t("Amortisman süresi")}</dt><dd>{current.paybackYears != null ? t("{n} yıl").replace("{n}", number(current.paybackYears, 1)) : "—"}</dd></div>
            {current.region && <div><dt>{t("Bölge fiyat endeksi")}</dt><dd>{percent(current.indexChange)}</dd></div>}
            {current.region && <div><dt>{t("Bölge yeni kiracı kira endeksi")}</dt><dd>{percent(current.rentIndexChange)}</dd></div>}
          </dl>
          {current.price != null && <div className="market-example">{t("100 m² bir konut için yaklaşık")}: <strong><DisplayMoney value={current.price * 100} currency="TRY"/></strong></div>}
          <div className="market-trend-box"><span><ChartLine size={15} aria-hidden="true"/>{t("m² fiyatının seyri")}</span><Trend points={current.trend} locale={locale}/></div>
          {current.name !== "Türkiye" && <Link className="market-listings-link" href={`/ilanlar?city=${encodeURIComponent(current.name)}`}>{t("{il} ilanlarını gör").replace("{il}", current.name)} <ArrowRight size={17} aria-hidden="true"/></Link>}
        </aside>
      </div>
    </section>

    <section className="market-table-card">
      <div className="market-table-head"><h2>{t("İllere göre")}: {t(metricLabel)}</h2><label className="city-map-search"><Search size={17} aria-hidden="true"/><input aria-label={t("Şehir ara")} placeholder={t("Şehir ara")} value={search} onChange={(event) => setSearch(event.target.value)}/></label></div>
      <div className="market-table-wrap"><table className="market-table">
        <thead><tr><th>{t("İl")}</th>{COLUMNS.map((column) => <th key={column.key} className={metric === column.key ? "active" : ""} aria-sort={metric === column.key ? (sortDesc ? "descending" : "ascending") : undefined}>
          <button type="button" onClick={() => { if (metric === column.key) setSortDesc((value) => !value); else { setMetric(column.key); setSortDesc(true); } }} title={t("Sırala")}>{t(column.label)} {metric === column.key ? (sortDesc ? "↓" : "↑") : ""}</button></th>)}</tr></thead>
        <tbody>{rows.map((item) => <tr key={item.name} className={selected === item.name ? "selected" : ""} onClick={() => { setSelected(item.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <td><button type="button" className="market-row-name">{item.name}</button></td>
          <td>{item.price != null ? <DisplayMoney value={item.price} currency="TRY"/> : "—"}</td><td className={item.priceChange != null && item.priceChange < 0 ? "down" : "up"}>{percent(item.priceChange)}</td>
          <td>{item.rent != null ? <DisplayMoney value={item.rent} currency="TRY"/> : "—"}</td><td>{item.grossYield != null ? `${number(item.grossYield, 1)} %` : "—"}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="market-notes">
      <h2><Info size={18} aria-hidden="true"/>{t("Veriler hakkında")}</h2>
      <ul>
        <li>{t("Kaynak: Türkiye Cumhuriyet Merkez Bankası (TCMB) Elektronik Veri Dağıtım Sistemi.")} <a href={EVDS_SOURCE_URL} target="_blank" rel="noreferrer">evds3.tcmb.gov.tr</a></li>
        <li>{t("m² satış fiyatı ve m² kira, bankaların konut kredisi için yaptırdığı değerleme raporlarından hesaplanır ve üç ayda bir yayınlanır; ilan fiyatı değildir.")}</li>
        <li>{t("Brüt kira getirisi = 12 aylık m² kira ÷ m² satış fiyatı. Vergi, aidat ve boş kalınan aylar düşülmemiştir.")}</li>
        <li>{t("Fiyat ve kira endeksleri aylıktır ve bölge düzeyinde yayınlanır; il kartında ilin bulunduğu bölgenin yıllık değişimi gösterilir.")}</li>
        <li>{t("Rakamlar genel bilgi içindir; yatırım tavsiyesi veya ekspertiz değildir.")} <Link href="/konut-degerleme">{t("Evinizin değerini ilanlarla karşılaştırın")}</Link></li>
      </ul>
      <p className="market-updated">{t("Son güncelleme")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(view.updatedAt))}</p>
    </section>
  </>;
}
