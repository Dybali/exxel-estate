// Housing market figures for /emlak-piyasasi from the Central Bank of Türkiye (TCMB EVDS, free API key):
//   Konut Birim Fiyatları (TL/m², quarterly, 81 provinces)         TP.BIRIMFIYAT.<IL>
//   Değerlemesi yapılan konutların birim kiraları (TL/m², quarterly) TP.BK.<IL>
//   Konut Fiyat Endeksi (monthly, 26 → 20 regions)                    TP.KFE.<REGION>
//   Yeni Kiracı Kira Endeksi (monthly, same regions)                  TP.YKKE.<REGION>
// The daily job stores one snapshot (market_stats table, created on first use); pages only read it.
// Pure logic here (tests: tests/market-stats.test.mjs); fetching and storage in lib/market-stats-server.ts.

export const EVDS_BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis/";
export const EVDS_SOURCE_URL = "https://evds3.tcmb.gov.tr/";

/** Province → [unit price series, unit rent series] where the TCMB code is not the plain ASCII name. */
const PRICE_CODE: Record<string, string> = { "İstanbul": "IST", "Ankara": "ANK", "İzmir": "IZM", "Afyonkarahisar": "AFYON", "Gaziantep": "ANTEP", "Kahramanmaraş": "MARAS", "Şanlıurfa": "URFA" };

/** TCMB regions of the monthly indices (KFE, YKKE) and their provinces. */
export const MARKET_REGIONS: Record<string, string[]> = {
  TR10: ["İstanbul"], TR51: ["Ankara"], TR31: ["İzmir"],
  TR21: ["Edirne", "Kırklareli", "Tekirdağ"], TR22: ["Balıkesir", "Çanakkale"], TR32: ["Aydın", "Denizli", "Muğla"],
  TR33: ["Afyonkarahisar", "Kütahya", "Manisa", "Uşak"], TR41: ["Bursa", "Eskişehir", "Bilecik"],
  TR42: ["Bolu", "Kocaeli", "Sakarya", "Yalova", "Düzce"], TR52: ["Konya", "Karaman"], TR61: ["Antalya", "Burdur", "Isparta"],
  TR62: ["Adana", "Mersin"], TR63: ["Hatay", "Kahramanmaraş", "Osmaniye"],
  TR7: ["Nevşehir", "Niğde", "Kırıkkale", "Kırşehir", "Aksaray", "Kayseri", "Sivas", "Yozgat"],
  TR8: ["Zonguldak", "Karabük", "Bartın", "Kastamonu", "Çankırı", "Sinop", "Samsun", "Tokat", "Çorum", "Amasya"],
  TR9: ["Trabzon", "Ordu", "Giresun", "Rize", "Artvin", "Gümüşhane"],
  TRA: ["Erzurum", "Erzincan", "Bayburt", "Ağrı", "Kars", "Iğdır", "Ardahan"],
  TRB: ["Malatya", "Elazığ", "Bingöl", "Tunceli", "Van", "Muş", "Bitlis", "Hakkari"],
  TRC: ["Gaziantep", "Adıyaman", "Kilis", "Şanlıurfa", "Diyarbakır", "Mardin", "Batman", "Şırnak", "Siirt"],
};

export const MARKET_PROVINCES = Object.values(MARKET_REGIONS).flat().sort((a, b) => a.localeCompare(b, "tr"));

export function asciiCode(name: string) {
  return name.toLocaleUpperCase("tr").replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/İ/g, "I").replace(/I/g, "I").replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ü/g, "U").replace(/Â/g, "A").replace(/[^A-Z]/g, "");
}
export function priceSeries(province: string) { return `TP.BIRIMFIYAT.${PRICE_CODE[province] || asciiCode(province)}`; }
export function rentSeries(province: string) { return `TP.BK.${asciiCode(province)}`; }
export function regionOf(province: string) { return Object.entries(MARKET_REGIONS).find(([, list]) => list.includes(province))?.[0] || null; }

export type Point = [period: string, value: number];
export type MarketSnapshot = {
  updatedAt: string;
  turkey: { price: Point[]; rent: Point[]; index: Point[]; rentIndex: Point[] };
  provinces: Record<string, { price: Point[]; rent: Point[] }>;
  regions: Record<string, { index: Point[]; rentIndex: Point[] }>;
  /** Batches that came back empty or failed (status or the start of the answer), for /api/market. */
  notes?: string[];
};

/** EVDS frequency codes: 5 monthly, 6 quarterly. A request must not mix them (the answer follows one frequency). */
export const EVDS_MONTHLY = 5, EVDS_QUARTERLY = 6;
export type SeriesBatch = { series: string[]; frequency: number };
/** Every series the snapshot needs, in request batches of one frequency (the EVDS URL takes a dash-separated list). */
export function marketSeriesBatches(size = 20): SeriesBatch[] {
  const quarterly = ["TP.BIRIMFIYAT.TR", "TP.BK.TR", ...MARKET_PROVINCES.flatMap((province) => [priceSeries(province), rentSeries(province)])];
  const monthly = ["TP.KFE.TR", "TP.YKKE.TR", ...Object.keys(MARKET_REGIONS).flatMap((region) => [`TP.KFE.${region}`, `TP.YKKE.${region}`])];
  const batches: SeriesBatch[] = [];
  for (const [all, frequency] of [[quarterly, EVDS_QUARTERLY], [monthly, EVDS_MONTHLY]] as const)
    for (let index = 0; index < all.length; index += size) batches.push({ series: all.slice(index, index + size), frequency });
  return batches;
}

const two = (value: number) => String(value).padStart(2, "0");
const evdsDate = (date: Date) => `${two(date.getUTCDate())}-${two(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
/** EVDS3 request URL: parameters are part of the path (no "?"), the key goes in the "key" header. */
export function evdsUrl(series: string[], from: Date, to: Date, frequency?: number) {
  return `${EVDS_BASE}series=${series.join("-")}&startDate=${evdsDate(from)}&endDate=${evdsDate(to)}&type=json${frequency ? `&frequency=${frequency}` : ""}`;
}

/** "2026-10", "2026-Q3", "2026-3" (quarter), "01-10-2026" → "2026-10" for months, "2026-Q3" for quarters. */
export function normalizePeriod(raw: string, quarterly: boolean): string | null {
  const text = String(raw || "").trim();
  let year: number, month: number | null = null, quarter: number | null = null;
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d{4})-Q([1-4])$/i))) { year = +match[1]; quarter = +match[2]; }
  else if ((match = text.match(/^(\d{4})-(\d{1,2})$/))) { year = +match[1]; if (quarterly && +match[2] <= 4) quarter = +match[2]; else month = +match[2]; }
  else if ((match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) { year = +match[3]; month = +match[2]; }
  else return null;
  if (quarterly) return `${year}-Q${quarter ?? Math.ceil((month || 1) / 3)}`;
  return month && month >= 1 && month <= 12 ? `${year}-${two(month)}` : null;
}

const QUARTERLY = /^TP\.(BIRIMFIYAT|BK)\./;
/** EVDS JSON ({items:[{Tarih, TP_KFE_TR: "123.4", ...}]}) → series code → points, oldest first. */
export function parseEvds(json: unknown, series: string[]): Record<string, Point[]> {
  const items = (json && typeof json === "object" && Array.isArray((json as { items?: unknown }).items) ? (json as { items: Record<string, unknown>[] }).items : []);
  const out: Record<string, Point[]> = {};
  for (const code of series) {
    const key = code.replace(/\./g, "_");
    const points = new Map<string, number>();
    for (const item of items) {
      const value = Number(String(item[key] ?? "").replace(",", "."));
      if (item[key] == null || item[key] === "" || !Number.isFinite(value) || value <= 0) continue;
      const period = normalizePeriod(String(item.Tarih ?? item.TARIH ?? ""), QUARTERLY.test(code));
      if (period) points.set(period, value);
    }
    out[code] = [...points.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  return out;
}

export function buildSnapshot(values: Record<string, Point[]>, now = new Date(), notes: string[] = []): MarketSnapshot {
  const get = (code: string) => values[code] || [];
  return {
    updatedAt: now.toISOString(), notes,
    turkey: { price: get("TP.BIRIMFIYAT.TR"), rent: get("TP.BK.TR"), index: get("TP.KFE.TR"), rentIndex: get("TP.YKKE.TR") },
    provinces: Object.fromEntries(MARKET_PROVINCES.map((province) => [province, { price: get(priceSeries(province)), rent: get(rentSeries(province)) }])),
    regions: Object.fromEntries(Object.keys(MARKET_REGIONS).map((region) => [region, { index: get(`TP.KFE.${region}`), rentIndex: get(`TP.YKKE.${region}`) }])),
  };
}

/** A snapshot is worth keeping when the national figures and most provinces came back. */
export function snapshotUsable(snapshot: MarketSnapshot | null | undefined): snapshot is MarketSnapshot {
  if (!snapshot?.turkey?.price?.length) return false;
  return Object.values(snapshot.provinces || {}).filter((item) => item.price.length).length >= 40;
}

const last = (points: Point[]) => points.length ? points[points.length - 1] : null;
/** Change against the value `steps` periods earlier (4 quarters or 12 months = one year), in percent. */
export function change(points: Point[], steps: number): number | null {
  if (points.length <= steps) return null;
  const now = points[points.length - 1][1], before = points[points.length - 1 - steps][1];
  return before > 0 ? (now / before - 1) * 100 : null;
}

export type ProvinceFigures = {
  name: string; region: string | null; period: string | null;
  price: number | null; priceChange: number | null; rent: number | null; rentChange: number | null;
  grossYield: number | null; paybackYears: number | null; indexChange: number | null; rentIndexChange: number | null;
  trend: Point[];
};

/** Figures shown for one province (or Türkiye with name "Türkiye"). Rent per m² is monthly. */
export function figures(name: string, price: Point[], rent: Point[], index: Point[], rentIndex: Point[], region: string | null): ProvinceFigures {
  const p = last(price), r = last(rent);
  // Yield only when price and rent describe the same quarter.
  const samePeriod = p && r && p[0] === r[0];
  const grossYield = samePeriod && p![1] > 0 ? (r![1] * 12) / p![1] * 100 : null;
  return {
    name, region, period: p?.[0] || null,
    price: p?.[1] ?? null, priceChange: change(price, 4),
    rent: r?.[1] ?? null, rentChange: change(rent, 4),
    grossYield, paybackYears: grossYield ? 100 / grossYield : null,
    indexChange: change(index, 12), rentIndexChange: change(rentIndex, 12),
    trend: price.slice(-21),
  };
}

export function marketView(snapshot: MarketSnapshot) {
  const turkey = figures("Türkiye", snapshot.turkey.price, snapshot.turkey.rent, snapshot.turkey.index, snapshot.turkey.rentIndex, null);
  const provinces = MARKET_PROVINCES.map((name) => {
    const region = regionOf(name);
    const data = snapshot.provinces[name] || { price: [], rent: [] };
    const regional = region ? snapshot.regions[region] : undefined;
    return figures(name, data.price, data.rent, regional?.index || [], regional?.rentIndex || [], region);
  });
  return { updatedAt: snapshot.updatedAt, indexPeriod: last(snapshot.turkey.index)?.[0] || null, turkey, provinces };
}
export type MarketView = ReturnType<typeof marketView>;
