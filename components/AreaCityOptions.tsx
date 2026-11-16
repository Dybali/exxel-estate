"use client";
import { useLocale } from "@/lib/i18n";
import { AREA_COUNTRIES } from "@/lib/service-locations";

// <option>s for Hizmetler and Müteahhitler city selects, grouped by country (Türkiye, Almanya).
export function AreaCityOptions() {
  const { t } = useLocale();
  return <>{AREA_COUNTRIES.map((country) => <optgroup key={country.code} label={t(country.label)}>{country.cities.map((city) => <option key={city} value={city}>{city}</option>)}</optgroup>)}</>;
}
