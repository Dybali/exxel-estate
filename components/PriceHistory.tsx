"use client";
import { useId } from "react";
import { ArrowRight, History, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useMoneyText } from "./DisplayCurrency";
import type { PriceChange, PriceDrop, PriceHistory, PricePoint } from "@/lib/price-history";

// Dates in UTC, like ListingDates, so the server and browser render the same day.
const dateText = (value: string, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
const percentText = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);

// Amounts follow the visitor's display currency (converted with the page's TCMB bulletin, "≈").

/** Next to the main price: the latest change was a decrease. */
export function PriceDropNote({ drop, currency }: { drop: PriceDrop; currency: string }) {
  const { locale, t } = useLocale();
  const formatPrice = useMoneyText();
  return <p className="price-drop-note">
    <b><TrendingDown size={14} aria-hidden="true"/>{t("Fiyat düştü")}</b>
    <em>{percentText(drop.change, locale)}</em>
    <del><i className="sr-only">{t("Eski fiyat")}: </i>{formatPrice(drop.oldPrice, currency)}</del>
  </p>;
}

const W = 320, H = 72, PAD = 7;
function Sparkline({ points, currency, labelId }: { points: PricePoint[]; currency: string; labelId: string }) {
  const { locale, t } = useLocale();
  const formatPrice = useMoneyText();
  const times = points.map((point) => Date.parse(point.at)), prices = points.map((point) => point.price);
  const t0 = times[0], t1 = times[times.length - 1], low = Math.min(...prices), high = Math.max(...prices);
  // Time on the x axis (evenly spaced if all changes share one moment); the price range fills the height.
  const x = (index: number) => PAD + (t1 > t0 ? (times[index] - t0) / (t1 - t0) : index / Math.max(1, points.length - 1)) * (W - 2 * PAD);
  const y = (price: number) => high > low ? PAD + (high - price) / (high - low) * (H - 2 * PAD) : H / 2;
  let line = `M${x(0).toFixed(1)} ${y(prices[0]).toFixed(1)}`;
  for (let index = 1; index < points.length; index++) line += ` H${x(index).toFixed(1)} V${y(prices[index]).toFixed(1)}`;
  const area = `${line} V${H} H${x(0).toFixed(1)} Z`;
  const label = t("İlk fiyat {start}, güncel fiyat {end}.").replace("{start}", formatPrice(prices[0], currency)).replace("{end}", formatPrice(prices[prices.length - 1], currency));
  return <figure className="price-history-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelId} focusable="false">
      <title id={labelId}>{label}</title>
      <path className="area" d={area}/>
      <path className="line" d={line}/>
      {points.slice(1, -1).map((point, index) => <circle key={point.at + index} cx={x(index + 1)} cy={y(point.price)} r="3.2"/>)}
      <circle className="current" cx={x(points.length - 1)} cy={y(prices[prices.length - 1])} r="3.8"/>
    </svg>
    <figcaption><time dateTime={points[0].at}>{dateText(points[0].at, locale)}</time><time dateTime={points[points.length - 1].at}>{dateText(points[points.length - 1].at, locale)}</time></figcaption>
  </figure>;
}

function ChangeRow({ change }: { change: PriceChange }) {
  const { locale, t } = useLocale();
  const money = useMoneyText();
  const price = (value: number) => money(value, change.currency);
  const note = change.kind === "currency" ? "Para birimi değişti" : change.kind === "purpose" ? "İlan türü değişti" : change.kind === "reset" ? "Fiyat yeniden belirlendi" : null;
  return <li className={`price-history-row ${change.kind}`}>
    <time dateTime={change.at}>{dateText(change.at, locale)}</time>
    {note
      ? <p><b>{price(change.newPrice)}</b><small>{t(note)}</small></p>
      : <p><del><i className="sr-only">{t("Eski fiyat")}: </i>{price(change.oldPrice)}</del><ArrowRight className="price-history-arrow" size={14} aria-hidden="true"/><b>{price(change.newPrice)}</b></p>}
    {change.change !== null && <em>{change.kind === "down" ? <TrendingDown size={14} aria-hidden="true"/> : <TrendingUp size={14} aria-hidden="true"/>}<i className="sr-only">{t(change.kind === "down" ? "Fiyat düştü" : "Fiyat arttı")}: </i>{percentText(change.change, locale)}</em>}
  </li>;
}

/** Compact block under the key facts; only rendered when the listing has at least one recorded change. */
export function PriceHistoryPanel({ history }: { history: PriceHistory }) {
  const { t } = useLocale();
  const id = useId(), headingId = `${id}-heading`, chartId = `${id}-chart`;
  const priced = history.changes.filter((change) => change.change !== null).length;
  return <section className="price-history" aria-labelledby={headingId}>
    <div className="price-history-head"><History size={17} aria-hidden="true"/><h2 id={headingId}>{t("Fiyat geçmişi")}</h2><p>{t("Fiyat değişiklikleri: {count}").replace("{count}", String(priced || history.changes.length))}</p></div>
    {history.points.length >= 2 && <Sparkline points={history.points} currency={history.currency} labelId={chartId}/>}
    <details className="price-history-details" open={history.changes.length <= 2}>
      <summary>{t("Tüm değişiklikler")}</summary>
      <ol>{history.changes.map((change, index) => <ChangeRow key={change.at + index} change={change}/>)}</ol>
    </details>
  </section>;
}
