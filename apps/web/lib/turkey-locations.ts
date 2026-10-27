import districtData from "@/data/locations/districts.json";

export const DISTRICTS = districtData as Record<string, string[]>;
export const CITIES = Object.keys(DISTRICTS);

export function districtsFor(city: string) {
  return DISTRICTS[city] || [];
}

export function validDistrict(city: string, district: string) {
  return districtsFor(city).includes(district);
}
