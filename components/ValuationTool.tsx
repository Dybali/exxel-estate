"use client";
import { useState } from "react";
import Link from "@/components/SafeLink";
import { ChartColumn, Home, Info, Search } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import type { ValuationResult } from "@/lib/valuation";

// /konut-degerleme: market comparison from published listings (lib/valuation.ts, /api/valuation).
const TYPES = [["daire", "Daire / rezidans"], ["mustakil", "Müstakil ev / villa"], ["arsa", "Arsa"], ["isyeri", "İş yeri"]] as const;
export function ValuationTool() {
  const { t, locale } = useLocale();
  const [form, setForm] = useState({ city: "", district: "", type: "daire", area: "" });
  const [result, setResult] = useState<ValuationResult | null | undefined>(undefined), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/valuation?${new URLSearchParams(form)}`), data = await apiJson<{ result?: ValuationResult | null; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Değerleme yapılamadı.");
      setResult(data.result ?? null);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const place = `${form.district ? `${form.district}, ` : ""}${form.city}`;
  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><ChartColumn size={15} aria-hidden="true"/> {t("KONUT DEĞERLEME")}</span>
      <h1>{t("Eviniz bugün ne eder?")}</h1>
      <p>{t("Bölgenizdeki yayındaki ilanlarla karşılaştırarak tahmini satış değerini ve kira getirisini görün. Ücretsizdir, üyelik gerekmez.")}</p>
    </div></section>
    <div className="container tools-grid">
      <form className="tool-card" onSubmit={submit}>
        <header><Home size={22} aria-hidden="true"/><div><h2>{t("Mülkünüzü tanımlayın")}</h2><p>{t("İlçe ve brüt metrekare ne kadar doğru olursa tahmin o kadar isabetli olur.")}</p></div></header>
        <div className="tool-inputs">
          <label className="tool-field"><span>{t("İl")}</span><select required value={form.city} onChange={(event) => setForm((old) => ({ ...old, city: event.target.value, district: "" }))}><option value="">{t("Seçin")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
          <label className="tool-field"><span>{t("İlçe")}</span><select value={form.district} disabled={!form.city} onChange={(event) => setForm((old) => ({ ...old, district: event.target.value }))}><option value="">{t("Tüm ilçeler")}</option>{(DISTRICTS[form.city] || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="tool-field"><span>{t("Mülk tipi")}</span><select value={form.type} onChange={(event) => setForm((old) => ({ ...old, type: event.target.value }))}>{TYPES.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label className="tool-field"><span>{t("Brüt alan (m²)")}</span><input required inputMode="numeric" value={form.area} onChange={(event) => setForm((old) => ({ ...old, area: event.target.value.replace(/\D/g, "").slice(0, 4) }))}/></label>
        </div>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="tool-actions"><button type="submit" className="primary-button" disabled={busy}><Search size={16} aria-hidden="true"/>{t(busy ? "Hesaplanıyor..." : "Değeri hesapla")}</button></div>
      </form>
      {result === null && <div className="agents-empty"><Info size={22} aria-hidden="true"/><p>{t("Bu bölgede karşılaştırma için yeterli ilan yok. İlçeyi \"Tüm ilçeler\" yaparak tekrar deneyin.")}</p></div>}
      {result && <article className="tool-card" aria-live="polite">
        <header><ChartColumn size={22} aria-hidden="true"/><div><h2>{t("Tahmini değer")}: {place}</h2><p>{t("{n} benzer ilana göre ({level}).").replace("{n}", number(result.count)).replace("{level}", t(result.level === "district" ? "ilçe" : "il geneli"))}</p></div></header>
        <dl className="tool-result">
          <div className="tool-result-main"><dt>{t("Tahmini satış değeri")}</dt><dd><Money value={result.value.mid} currency="TRY"/></dd></div>
          <div><dt>{t("Değer aralığı")}</dt><dd className="tool-range"><Money value={result.value.low} currency="TRY"/> – <Money value={result.value.high} currency="TRY"/></dd></div>
          <div><dt>{t("m² fiyatı (orta)")}</dt><dd><Money value={result.perM2.mid} currency="TRY"/></dd></div>
        </dl>
        {result.rent ? <dl className="tool-result">
          <div><dt>{t("Tahmini aylık kira")}</dt><dd><Money value={result.rent.value.mid} currency="TRY"/></dd></div>
          {result.yieldPercent != null && <div><dt>{t("Brüt kira getirisi")}</dt><dd>%{number(result.yieldPercent)}</dd></div>}
          {result.paybackYears != null && <div><dt>{t("Kira geri dönüş süresi")}</dt><dd>{t("{n} yıl").replace("{n}", number(result.paybackYears))}</dd></div>}
        </dl> : <p className="tool-note">{t("Kira tahmini için bu bölgede yeterli kiralık ilan yok.")}</p>}
        <p className="tool-note">{t("Tahmin, yayındaki ilanların istenen fiyatlarından hesaplanır; gerçek satış fiyatları farklı olabilir. Kredi ve resmî işlemler için lisanslı bir değerleme uzmanının ekspertiz raporu gerekir.")}</p>
        <div className="tool-actions"><Link className="primary-button" href="/ilan-ver">{t("Mülkünüzü ilan verin")}</Link><Link className="outline-button" href="/danismanlar">{t("Bir danışmana sorun")}</Link><Link className="outline-button" href="/hesaplama-araclari#tapu-masrafi">{t("Tapu masraflarını hesaplayın")}</Link></div>
      </article>}
    </div>
  </main>;
}
