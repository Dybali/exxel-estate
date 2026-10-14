"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { CITIES, PROPERTY_TYPES } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

export function HomeSearch() {
  const { t } = useLocale();
  const [purpose, setPurpose] = useState("satilik");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [rooms, setRooms] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = new URLSearchParams({ purpose });
    if (city) query.set("city", city);
    if (type) query.set("type", type);
    if (rooms) query.set("rooms", rooms);
    window.location.assign(`/ilanlar?${query}`);
  };
  return <form className="home-search" onSubmit={submit}>
    <div className="home-search-tabs"><button type="button" className={purpose === "satilik" ? "active" : ""} onClick={() => setPurpose("satilik")}>{t("Satılık")}</button><button type="button" className={purpose === "kiralik" ? "active" : ""} onClick={() => setPurpose("kiralik")}>{t("Kiralık")}</button></div>
    <div className="home-search-fields">
      <label><span>{t("Şehir")}</span><select value={city} onChange={(e) => setCity(e.target.value)}><option value="">{t("Tüm şehirler")}</option>{CITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>{t("Gayrimenkul tipi")}</span><select value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("Tüm tipler")}</option>{PROPERTY_TYPES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
      <label><span>{t("Oda düzeni")}</span><select value={rooms} onChange={(e) => setRooms(e.target.value)}><option value="">{t("Tümü")}</option>{["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="home-search-submit" type="submit"><Search size={19}/>{t("İlan ara")}</button>
    </div>
  </form>;
}
