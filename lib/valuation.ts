// "Konut değerleme" (/konut-degerleme): an estimate of a home's sale value and rent from published listings
// of the same kind in the same district (or the whole province when the district has too few), weighted
// towards homes of a similar size. It is a market comparison, not an appraisal (ekspertiz), and says so.
export const VALUATION_MIN = 5;
export type Comparable = { price: number; area: number; district: string };
export type Band = { low: number; mid: number; high: number };
export type ValuationResult = {
  level: "district" | "city"; count: number; perM2: Band; value: Band;
  rent: { level: "district" | "city"; count: number; perM2: Band; value: Band } | null;
  yieldPercent: number | null; paybackYears: number | null;
};

/** Quantile of sorted numbers (linear interpolation). */
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q, low = Math.floor(position), high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Comparables in the district if there are enough, else the province; similar sizes (±35 %) when enough remain. */
export function pickComparables(rows: Comparable[], district: string, area: number) {
  const usable = rows.filter((row) => row.price > 0 && row.area >= 15 && row.area <= 5000 && row.price / row.area > 0);
  const inDistrict = district ? usable.filter((row) => row.district === district) : [];
  const base = inDistrict.length >= VALUATION_MIN ? inDistrict : usable, level: "district" | "city" = inDistrict.length >= VALUATION_MIN ? "district" : "city";
  const similar = base.filter((row) => row.area >= area * 0.65 && row.area <= area * 1.35);
  return { level, rows: similar.length >= VALUATION_MIN ? similar : base };
}

export function band(rows: Comparable[], area: number, step: number) {
  // Outliers (typos, whole buildings) are trimmed by using the interquartile range only.
  const perM2 = rows.map((row) => row.price / row.area).sort((a, b) => a - b);
  const quartiles = { low: quantile(perM2, 0.25), mid: quantile(perM2, 0.5), high: quantile(perM2, 0.75) };
  return { perM2: { low: Math.round(quartiles.low), mid: Math.round(quartiles.mid), high: Math.round(quartiles.high) }, value: { low: roundTo(quartiles.low * area, step), mid: roundTo(quartiles.mid * area, step), high: roundTo(quartiles.high * area, step) } };
}

export function valuate(sales: Comparable[], rents: Comparable[], district: string, area: number): ValuationResult | null {
  if (!(area >= 15 && area <= 5000)) return null;
  const sale = pickComparables(sales, district, area);
  if (sale.rows.length < VALUATION_MIN) return null;
  const saleBand = band(sale.rows, area, 10000);
  const rent = pickComparables(rents, district, area);
  const rentBand = rent.rows.length >= VALUATION_MIN ? band(rent.rows, area, 250) : null;
  const yearly = rentBand ? rentBand.value.mid * 12 : 0;
  return {
    level: sale.level, count: sale.rows.length, ...saleBand,
    rent: rentBand ? { level: rent.level, count: rent.rows.length, ...rentBand } : null,
    yieldPercent: yearly && saleBand.value.mid ? Math.round(yearly / saleBand.value.mid * 1000) / 10 : null,
    paybackYears: yearly && saleBand.value.mid ? Math.round(saleBand.value.mid / yearly * 10) / 10 : null,
  };
}
