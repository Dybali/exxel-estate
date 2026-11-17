"use client";
import { useState } from "react";
import Link from "@/components/SafeLink";
import { Calculator, FileText, Landmark, TrendingUp } from "lucide-react";
import { Money, useLocale } from "@/lib/i18n";
import { deedCosts, deedFee, rentIncrease, type FeeSplit } from "@/lib/property-calculators";

type Defaults = { rentRate: number | null; rentMonth: string | null; revolvingFee: number | null };
const TOOLS = [
  { id: "kira-artisi", label: "Kira artışı", icon: TrendingUp },
  { id: "tapu-harci", label: "Tapu harcı", icon: Landmark },
  { id: "tapu-masrafi", label: "Tapu masrafları", icon: FileText },
] as const;
const amount = (value: string) => value.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");

function MoneyInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  const { t } = useLocale();
  return <label className="tool-field"><span>{t(label)}</span>
    <span className="tool-money"><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0"/><b>TL</b></span>
    {hint && <small>{t(hint)}</small>}</label>;
}

function RentTool({ defaults }: { defaults: Defaults }) {
  const { t, locale } = useLocale();
  const [rent, setRent] = useState(""), [rate, setRate] = useState(defaults.rentRate ? String(defaults.rentRate) : "");
  const result = rentIncrease(amount(rent), rate.replace(",", "."));
  const month = defaults.rentMonth ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${defaults.rentMonth}-15T12:00:00Z`)) : null;
  return <article id="kira-artisi" className="tool-card">
    <header><TrendingUp size={22} aria-hidden="true"/><div><h2>{t("Kira artışı hesaplama")}</h2><p>{t("Konut ve iş yeri kiraları, kira yılı dolduğunda en fazla TÜFE'nin 12 aylık ortalama değişimi kadar artırılabilir (Türk Borçlar Kanunu md. 344).")}</p></div></header>
    <div className="tool-inputs">
      <MoneyInput label="Mevcut aylık kira" value={rent} onChange={setRent}/>
      <label className="tool-field"><span>{t("TÜFE 12 aylık ortalama değişim (%)")}</span>
        <span className="tool-money"><input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="0"/><b>%</b></span>
        <small>{month ? t("{month} için açıklanan oran. Kira yılınızın dolduğu ayın oranını kullanın.").replace("{month}", month) : t("Kira yılınızın dolduğu ay için TÜİK'in açıkladığı oranı girin.")} <a href="https://data.tuik.gov.tr" target="_blank" rel="noopener noreferrer">{"TÜİK"}</a></small></label>
    </div>
    {result ? <dl className="tool-result">
      <div className="tool-result-main"><dt>{t("Yeni aylık kira (en fazla)")}</dt><dd><Money value={result.next} currency="TRY" fractionDigits={2}/></dd></div>
      <div><dt>{t("Aylık artış")}</dt><dd><Money value={result.increase} currency="TRY" fractionDigits={2}/></dd></div>
      <div><dt>{t("Yıllık kira")}</dt><dd><Money value={result.yearly} currency="TRY" fractionDigits={2}/></dd></div>
    </dl> : <p className="tool-empty">{t("Kira tutarını ve oranı girin.")}</p>}
    <p className="tool-note">{t("Taraflar daha düşük bir artışta anlaşabilir. Beş yılı dolduran kira ilişkilerinde kira bedeli hâkim tarafından yeniden belirlenebilir.")}</p>
  </article>;
}

function FeeTool() {
  const { t } = useLocale();
  const [price, setPrice] = useState(""), [split, setSplit] = useState<FeeSplit>("both");
  const result = deedFee(amount(price), split);
  return <article id="tapu-harci" className="tool-card">
    <header><Landmark size={22} aria-hidden="true"/><div><h2>{t("Tapu harcı hesaplama")}</h2><p>{t("Satışta tapu harcı, beyan edilen satış bedelinin binde 20'si alıcıdan, binde 20'si satıcıdan alınır (492 sayılı Harçlar Kanunu).")}</p></div></header>
    <div className="tool-inputs">
      <MoneyInput label="Tapuda beyan edilecek satış bedeli" value={price} onChange={setPrice} hint="Beyan edilen bedel, taşınmazın emlak vergi değerinden düşük olamaz."/>
      <fieldset className="tool-field tool-choice"><legend>{t("Harcı kim ödüyor?")}</legend>
        <label><input type="radio" name="fee-split" checked={split === "both"} onChange={() => setSplit("both")}/>{t("Alıcı ve satıcı ayrı ayrı (yasal durum)")}</label>
        <label><input type="radio" name="fee-split" checked={split === "buyer"} onChange={() => setSplit("buyer")}/>{t("Tamamını alıcı ödüyor (anlaşmayla)")}</label>
      </fieldset>
    </div>
    {result ? <dl className="tool-result">
      <div className="tool-result-main"><dt>{t("Toplam tapu harcı")}</dt><dd><Money value={result.total} currency="TRY" fractionDigits={2}/></dd></div>
      <div><dt>{t("Alıcı öder")}</dt><dd><Money value={result.buyer} currency="TRY" fractionDigits={2}/></dd></div>
      <div><dt>{t("Satıcı öder")}</dt><dd><Money value={result.seller} currency="TRY" fractionDigits={2}/></dd></div>
    </dl> : <p className="tool-empty">{t("Satış bedelini girin.")}</p>}
    <p className="tool-note">{t("Gerçek bedelden düşük beyan, vergi cezası ve kredi sorunlarına yol açabilir.")}</p>
  </article>;
}

function CostTool({ defaults }: { defaults: Defaults }) {
  const { t } = useLocale();
  const [price, setPrice] = useState(""), [revolving, setRevolving] = useState(defaults.revolvingFee ? String(defaults.revolvingFee) : "");
  const [dask, setDask] = useState(""), [appraisal, setAppraisal] = useState(""), [commission, setCommission] = useState("");
  const result = deedCosts({ price: amount(price), revolvingFee: amount(revolving), dask: amount(dask), appraisal: amount(appraisal), commissionPercent: commission.replace(",", ".") });
  return <article id="tapu-masrafi" className="tool-card">
    <header><FileText size={22} aria-hidden="true"/><div><h2>{t("Tapu masrafı hesaplama")}</h2><p>{t("Ev alırken tapu harcının yanında ödenen döner sermaye ücreti, DASK, ekspertiz ve emlakçı hizmet bedelini toplayın.")}</p></div></header>
    <div className="tool-inputs tool-inputs-wide">
      <MoneyInput label="Satış bedeli" value={price} onChange={setPrice}/>
      <MoneyInput label="Döner sermaye ücreti" value={revolving} onChange={setRevolving} hint="Tapu müdürlüğünün bu yıl için belirlediği tutar."/>
      <MoneyInput label="DASK primi" value={dask} onChange={setDask} hint="Konutun büyüklüğüne ve bölgesine göre değişir."/>
      <MoneyInput label="Ekspertiz ücreti" value={appraisal} onChange={setAppraisal} hint="Konut kredisi kullanılacaksa."/>
      <label className="tool-field"><span>{t("Emlakçı hizmet bedeli (%)")}</span>
        <span className="tool-money"><input inputMode="decimal" value={commission} onChange={(event) => setCommission(event.target.value)} placeholder="0"/><b>%</b></span>
        <small>{t("Alıcıdan alınabilecek üst sınır %2 + KDV'dir.")}</small></label>
    </div>
    {result ? <>
      <ul className="tool-lines">{result.items.map((item) => <li key={item.key}><span>{t(item.label)}</span><Money value={item.amount} currency="TRY" fractionDigits={2}/></li>)}</ul>
      <dl className="tool-result"><div className="tool-result-main"><dt>{t("Alıcının toplam masrafı")}</dt><dd><Money value={result.total} currency="TRY" fractionDigits={2}/></dd></div>
        <div><dt>{t("Satıcının tapu harcı")}</dt><dd><Money value={result.sellerFee} currency="TRY" fractionDigits={2}/></dd></div></dl>
    </> : <p className="tool-empty">{t("Satış bedelini girin.")}</p>}
    <p className="tool-note">{t("Yeni konutlarda KDV ve kredi kullanımında banka masrafları ayrıca doğabilir.")}</p>
  </article>;
}

export function PropertyCalculators({ defaults }: { defaults: Defaults }) {
  const { t } = useLocale();
  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Calculator size={15} aria-hidden="true"/> {t("HESAPLAMA ARAÇLARI")}</span>
      <h1>{t("Emlak hesaplama araçları")}</h1>
      <p>{t("Kira artışını, tapu harcını ve ev alırken ödeyeceğiniz masrafları önceden hesaplayın.")}</p>
      <nav className="tools-tabs" aria-label={t("Hesaplama araçları")}>{TOOLS.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`}><Icon size={16} aria-hidden="true"/>{t(label)}</a>)}
        <Link href="/konut-degerleme"><Calculator size={16} aria-hidden="true"/>{t("Konut değerleme")}</Link></nav>
    </div></section>
    <div className="container tools-grid"><RentTool defaults={defaults}/><FeeTool/><CostTool defaults={defaults}/></div>
    <p className="container tools-disclaimer">{t("Hesaplamalar bilgi amaçlıdır; resmî tutarlar için tapu müdürlüğüne, vergi dairesine veya bir avukata danışın.")}</p>
  </main>;
}
