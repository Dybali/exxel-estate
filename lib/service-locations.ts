// Places for Hizmetler and Müteahhitler: Turkish provinces (with districts) and, for future use, German cities
// (no districts). Stored as the plain city name, so no database change is needed; the country follows from the
// name (no German city shares a name with a Turkish province). Kat karşılığı land requests stay Türkiye-only.
import { CITIES, districtsFor, validDistrict } from "./turkey-locations";
import { cityBySlug, districtBySlug, regionSlug } from "./region-pages";

export const GERMAN_CITIES: readonly string[] = [
  "Aachen", "Augsburg", "Bergisch Gladbach", "Berlin", "Bielefeld", "Bochum", "Bonn", "Bottrop", "Braunschweig", "Bremen", "Bremerhaven",
  "Chemnitz", "Cottbus", "Darmstadt", "Dortmund", "Dresden", "Duisburg", "Düsseldorf", "Erfurt", "Erlangen", "Essen", "Frankfurt am Main",
  "Freiburg im Breisgau", "Fürth", "Gelsenkirchen", "Göttingen", "Gütersloh", "Hagen", "Halle (Saale)", "Hamburg", "Hamm", "Hannover",
  "Heidelberg", "Heilbronn", "Herne", "Hildesheim", "Ingolstadt", "Jena", "Kaiserslautern", "Karlsruhe", "Kassel", "Kiel", "Koblenz", "Köln",
  "Krefeld", "Leipzig", "Leverkusen", "Lübeck", "Ludwigshafen am Rhein", "Magdeburg", "Mainz", "Mannheim", "Mönchengladbach",
  "Mülheim an der Ruhr", "München", "Münster", "Neuss", "Nürnberg", "Oberhausen", "Offenbach am Main", "Oldenburg", "Osnabrück",
  "Paderborn", "Pforzheim", "Potsdam", "Recklinghausen", "Regensburg", "Remscheid", "Reutlingen", "Rostock", "Saarbrücken", "Salzgitter",
  "Schwerin", "Siegen", "Solingen", "Stuttgart", "Trier", "Ulm", "Wiesbaden", "Wolfsburg", "Wuppertal", "Würzburg",
];
export const AREA_COUNTRIES = [{ code: "TR", label: "Türkiye", cities: CITIES }, { code: "DE", label: "Almanya", cities: GERMAN_CITIES }] as const;
export const AREA_CITIES: readonly string[] = [...CITIES, ...GERMAN_CITIES];
const GERMAN_BY_SLUG = new Map(GERMAN_CITIES.map((city) => [regionSlug(city), city]));

export function areaCountry(city: string): "TR" | "DE" | null {
  return CITIES.includes(city) ? "TR" : GERMAN_CITIES.includes(city) ? "DE" : null;
}
/** Districts to choose from; German cities have none (the whole city). */
export const areaDistricts = (city: string) => areaCountry(city) === "TR" ? districtsFor(city) : [];
/** A known province/city, and a district only where districts exist. */
export function validArea(city: string, district = "") {
  const country = areaCountry(city);
  return country === "TR" ? !district || validDistrict(city, district) : country === "DE" ? !district : false;
}
export const areaCityBySlug = (slug: string) => cityBySlug(slug) ?? GERMAN_BY_SLUG.get(slug) ?? null;
export const areaDistrictBySlug = (city: string, slug: string) => areaCountry(city) === "TR" ? districtBySlug(city, slug) : null;
