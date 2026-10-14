import neighborhoodData from "@/data/locations/neighborhoods.json";
import { validDistrict } from "./turkey-locations";

const neighborhoods = neighborhoodData as Record<string, Record<string, string[]>>;

export function neighborhoodsFor(city: string, district: string) {
  if (!validDistrict(city, district)) return [];
  return neighborhoods[city]?.[district] || [];
}

export function validNeighborhood(city: string, district: string, neighborhood: string) {
  return neighborhoodsFor(city, district).includes(neighborhood);
}
