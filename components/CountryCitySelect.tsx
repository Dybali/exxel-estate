"use client";
import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { AREA_COUNTRIES, areaCountry } from "@/lib/service-locations";

type Country = (typeof AREA_COUNTRIES)[number]["code"];
type Props = {
  /** Controlled use: the chosen city ("" for none) and its change handler. */
  value?: string; onChange?: (city: string) => void;
  /** Uncontrolled use inside a GET form (Müteahhitler filter): field name and initial city. */
  name?: string; defaultValue?: string;
  required?: boolean;
  /** Text of the empty option per country, e.g. { TR: "Tüm Türkiye", DE: "Şehir seçin" }. */
  placeholder: Record<Country, string>;
};

// Hizmetler and Müteahhitler: first the country (flag buttons), then a city of that country
// (lib/service-locations.ts). Switching the country clears the city.
export function CountryCitySelect({ value, onChange, name, defaultValue = "", required, placeholder }: Props) {
  const { t } = useLocale();
  const controlled = value !== undefined;
  const [own, setOwn] = useState(defaultValue);
  const city = controlled ? value : own;
  const [country, setCountry] = useState<Country>(areaCountry(city) || "TR");
  const shown = AREA_COUNTRIES.find((item) => item.code === country)!;
  const change = (next: string) => { if (!controlled) setOwn(next); onChange?.(next); };
  const pick = (code: Country) => { if (code === country) return; setCountry(code); change(""); };
  return <span className="country-city">
    <span className="country-switch" role="radiogroup" aria-label={t("Ülke")}>
      {/* Spans, not buttons: the picker sits inside the field's <label>, which would forward clicks on its
          text to the first button and switch the country back. */}
      {AREA_COUNTRIES.map((item) => <span key={item.code} role="radio" tabIndex={0} aria-checked={country === item.code} className={`country-option country-${item.code.toLowerCase()}`}
        onClick={(event) => { event.preventDefault(); pick(item.code); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(item.code); } }}>
        <img src={`/flags/${item.code.toLowerCase()}.svg`} alt="" width={20} height={14}/>{t(item.label)}
      </span>)}
    </span>
    <select name={name} required={required} value={city} onChange={(event) => change(event.target.value)}>
      <option value="">{t(placeholder[country])}</option>
      {shown.cities.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  </span>;
}
