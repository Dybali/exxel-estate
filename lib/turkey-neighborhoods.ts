import neighborhoodData from "@/data/locations/neighborhoods.json";
import { validDistrict } from "./turkey-locations";

export type Neighborhood = { id: number; name: string; postalCode: string; label: string };
const neighborhoods = neighborhoodData as Record<string, Record<string, Neighborhood[]>>;

export function neighborhoodsFor(city: string, district: string) {
  if (!validDistrict(city, district)) return [];
  return neighborhoods[city]?.[district] || [];
}

export function findNeighborhood(city: string, district: string, id: number) {
  if (!Number.isInteger(id)) return undefined;
  return neighborhoodsFor(city, district).find((item) => item.id === id);
}
