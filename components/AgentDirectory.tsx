"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { BadgeCheck, Building2, ChevronRight, Languages, MapPin, Phone, Search, SlidersHorizontal, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { DisplayMoney } from "@/components/DisplayCurrency";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import { AGENT_LANGUAGES, AGENTS_PER_PAGE, type AgentCard, type AgentLanguage, type AgentQuery, type OfficeCard } from "@/lib/agent-directory";

// /danismanlar (redesigned 2026-11-23, like the big portals): consultants or offices as rows with the facts that
// matter (office, area, languages, active listings, average sale price, listings in the last three months) and a
// direct call button. Filters are a GET form, so every filtered page has its own address and is rendered on the
// server (lib/agent-directory.ts).
export function useLanguageName() {
  const { locale } = useLocale();
  const names = (() => { try { return new Intl.DisplayNames([locale], { type: "language" }); } catch { return null; } })();
  return (code: string) => { const name = names?.of(code) || code; return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1); };
}

export function PhoneButton({ id, primary = false }: { id: string; primary?: boolean }) {
  const { t } = useLocale();
  const [phone, setPhone] = useState<string | null>(null), [error, setError] = useState(false);
  if (phone) return <a className="primary-button" href={`tel:${phone}`}><Phone size={15} aria-hidden="true"/><bdi>{phone}</bdi></a>;
  return <button type="button" className={primary ? "primary-button" : "outline-button"} onClick={() => fetch(`/api/agents?phone=${id}`).then((response) => apiJson<{ phone?: string }>(response)).then((data) => data.phone ? setPhone(data.phone) : setError(true)).catch(() => setError(true))}>
    <Phone size={15} aria-hidden="true"/>{t(error ? "Telefon numarası yok" : primary ? "Hemen ara" : "Telefonu göster")}</button>;
}

const FLAG: Partial<Record<AgentLanguage, string>> = { tr: "tr", en: "gb", de: "de", ru: "ru", ar: "sa", fa: "ir", fr: "fr", nl: "nl", es: "es", it: "it" };
function LanguageList({ languages }: { languages: AgentLanguage[] }) {
  const { t } = useLocale(), language = useLanguageName();
  if (!languages.length) return null;
  return <span className="adir-langs" title={languages.map(language).join(", ")}><Languages size={13} aria-hidden="true"/>
    {languages.slice(0, 4).map((code) => FLAG[code] ? <img key={code} src={`/flags/${FLAG[code]}.svg`} alt={language(code)} width={18} height={13}/> : <span key={code} className="adir-lang-code">{code.toUpperCase()}</span>)}
    <span>{t("{n} dil").replace("{n}", String(languages.length))}</span></span>;
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  const { t } = useLocale();
  return <div className="adir-stat"><strong>{value}</strong><span>{t(label)}</span></div>;
}

function AgentRow({ agent }: { agent: AgentCard }) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <article className={`adir-row${agent.plan ? " has-plan" : ""}`}>
    {agent.plan && <span className={`adir-ribbon ${agent.plan}`}>{agent.plan === "prestige" ? "PRESTİJ" : "PROFESYONEL"}</span>}
    <Link className="adir-photo" href={`/profil/${agent.id}`} aria-label={agent.name}>
      {agent.avatarUrl ? <img src={agent.avatarUrl} alt="" loading="lazy"/> : <span aria-hidden="true">{agent.name.split(" ").map((part) => part.charAt(0)).slice(0, 2).join("").toLocaleUpperCase(locale)}</span>}
      {agent.office?.logo && <img className="adir-office-logo" src={agent.office.logo} alt="" loading="lazy"/>}
    </Link>
    <div className="adir-main">
      <h2><Link href={`/profil/${agent.id}`}>{agent.name}</Link>{agent.verified && <BadgeCheck size={17} className="adir-verified" aria-label={t("Belgesi doğrulanmış")}/>}</h2>
      {agent.office ? <Link className="adir-office" href={`/sirketler/${agent.office.id}`}><Building2 size={13} aria-hidden="true"/>{agent.office.name}</Link> : agent.company ? <span className="adir-office"><Building2 size={13} aria-hidden="true"/>{agent.company}</span> : <span className="adir-office muted">{t("Bağımsız danışman")}</span>}
      <p className="adir-meta">{agent.city && <span><MapPin size={13} aria-hidden="true"/>{agent.district ? `${agent.district}, ` : ""}{agent.city}</span>}<LanguageList languages={agent.languages}/></p>
      {agent.about && <p className="adir-about" lang="">“{agent.about}”</p>}
    </div>
    <div className="adir-stats">
      <Stat value={number(agent.listings)} label="Aktif ilan"/>
      <Stat value={agent.saleAverage ? <DisplayMoney value={agent.saleAverage} currency="TRY"/> : "—"} label="Ort. satış fiyatı"/>
      <Stat value={number(agent.recent)} label="Son 3 ay"/>
    </div>
    <div className="adir-actions"><PhoneButton id={agent.id} primary/><Link className="outline-button" href={`/profil/${agent.id}`}>{t("Profil ve ilanlar")}<ChevronRight size={15} aria-hidden="true"/></Link></div>
  </article>;
}

function OfficeRow({ office }: { office: OfficeCard }) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <article className="adir-row">
    <Link className="adir-photo office" href={`/sirketler/${office.id}`} aria-label={office.name}>
      {office.logo ? <img src={office.logo} alt="" loading="lazy"/> : <Building2 size={30} aria-hidden="true"/>}
    </Link>
    <div className="adir-main">
      <h2><Link href={`/sirketler/${office.id}`}>{office.name}</Link>{office.verified && <BadgeCheck size={17} className="adir-verified" aria-label={t("Belgesi doğrulanmış")}/>}</h2>
      <span className="adir-office"><Users size={13} aria-hidden="true"/>{t("{n} danışman").replace("{n}", number(office.consultants))}</span>
      <p className="adir-meta">{office.city && <span><MapPin size={13} aria-hidden="true"/>{office.district ? `${office.district}, ` : ""}{office.city}</span>}<LanguageList languages={office.languages}/></p>
    </div>
    <div className="adir-stats">
      <Stat value={number(office.listings)} label="Aktif ilan"/>
      <Stat value={number(office.consultants)} label="Danışman"/>
      <Stat value={number(office.recent)} label="Son 3 ay"/>
    </div>
    <div className="adir-actions"><Link className="primary-button" href={`/sirketler/${office.id}`}>{t("Ofisi incele")}<ChevronRight size={15} aria-hidden="true"/></Link></div>
  </article>;
}

export function AgentDirectory({ view, query, total, agents, offices }: { view: "agents" | "offices"; query: AgentQuery; total: number; agents: AgentCard[]; offices: OfficeCard[] }) {
  const { t, locale } = useLocale(), language = useLanguageName();
  const [city, setCity] = useState(query.city || "");
  useEffect(() => setCity(query.city || ""), [query.city]);
  const page = query.page || 1, pages = Math.max(1, Math.ceil(total / AGENTS_PER_PAGE));
  const params = (extra: Record<string, string>) => { const values = new URLSearchParams(Object.entries({ il: query.city, ilce: query.district, dil: query.language, q: query.q, tur: query.purpose, uzmanlik: query.specialty, sira: query.sort === "onerilen" ? "" : query.sort, ...extra }).filter(([, value]) => value) as [string, string][]); const text = values.toString(); return `/danismanlar${text ? `?${text}` : ""}`; };
  const pageHref = (next: number) => params({ gorunum: view === "offices" ? "ofisler" : "", sayfa: next > 1 ? String(next) : "" });
  return <main className="tools-page adir-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Users size={15} aria-hidden="true"/> {t("DANIŞMAN BUL")}</span>
      <h1>{t("Gayrimenkul danışmanları")}</h1>
      <p>{t("Bölgenizdeki emlak danışmanlarını ve ofisleri ilan sayıları, konuştukları diller ve bağlı oldukları ofisle inceleyin; size uygun uzmana doğrudan ulaşın.")}</p>
    </div></section>
    <div className="container adir-body">
      <section className="adir-head">
        <div className="adir-title"><h2>{t(view === "offices" ? "Emlak ofisleri" : "Gayrimenkul danışmanları")}</h2><span>{t(view === "offices" ? "{n} ofis bulundu" : "{n} danışman bulundu").replace("{n}", new Intl.NumberFormat(locale).format(total))}</span></div>
        <nav className="adir-switch" aria-label={t("Görünüm")}>
          <Link href={params({})} className={view === "agents" ? "active" : ""} aria-current={view === "agents" ? "page" : undefined}>{t("Danışmanlar")}</Link>
          <Link href={params({ gorunum: "ofisler" })} className={view === "offices" ? "active" : ""} aria-current={view === "offices" ? "page" : undefined}>{t("Ofisler")}</Link>
        </nav>
        <form className="adir-filters" method="get" action="/danismanlar">
          {view === "offices" && <input type="hidden" name="gorunum" value="ofisler"/>}
          <label><span>{t("İl")}</span><select name="il" value={city} onChange={(event) => setCity(event.target.value)}><option value="">{t("Tümü")}</option>{CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>{t("İlçe")}</span><select name="ilce" defaultValue={query.district || ""} disabled={!city} key={city}><option value="">{t("Tümü")}</option>{(DISTRICTS[city] || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>{t("Konuştuğu dil")}</span><select name="dil" defaultValue={query.language || ""}><option value="">{t("Tümü")}</option>{AGENT_LANGUAGES.map((code: AgentLanguage) => <option key={code} value={code}>{language(code)}</option>)}</select></label>
          <label><span>{t("İlan türü")}</span><select name="tur" defaultValue={query.purpose || ""}><option value="">{t("Tümü")}</option><option value="satilik">{t("Satılık")}</option><option value="kiralik">{t("Kiralık")}</option></select></label>
          <label><span>{t("Uzmanlık")}</span><select name="uzmanlik" defaultValue={query.specialty || ""}><option value="">{t("Tümü")}</option><option value="konut">{t("Konut")}</option><option value="isyeri">{t("İş yeri")}</option><option value="arsa">{t("Arsa")}</option><option value="turistik">{t("Turistik tesis")}</option></select></label>
          {view === "agents" && <label><span>{t("Sıralama")}</span><select name="sira" defaultValue={query.sort || "onerilen"}><option value="onerilen">{t("Önerilen")}</option><option value="ilan">{t("En çok ilan")}</option><option value="yeni">{t("Son 3 ayda en aktif")}</option><option value="fiyat">{t("Ortalama fiyat (yüksek)")}</option></select></label>}
          <label className="adir-search"><span>{t(view === "offices" ? "Ofis adı" : "Ad veya ofis")}</span><input name="q" maxLength={80} defaultValue={query.q || ""}/></label>
          <button type="submit" className="primary-button"><Search size={16} aria-hidden="true"/>{t("Ara")}</button>
        </form>
      </section>
      {view === "offices"
        ? offices.length ? <div className="adir-list">{offices.map((office) => <OfficeRow key={office.id} office={office}/>)}</div> : <div className="agents-empty"><p>{t("Bu ölçütlere uygun ofis bulunamadı.")}</p></div>
        : agents.length ? <div className="adir-list">{agents.map((agent) => <AgentRow key={agent.id} agent={agent}/>)}</div>
          : <div className="agents-empty"><SlidersHorizontal size={26} aria-hidden="true"/><p>{t("Bu ölçütlere uygun danışman bulunamadı.")}</p><p><Link href="/benim-icin-bul">{t("Benim için bul formuyla talebinizi bırakın")}</Link></p></div>}
      {pages > 1 && <nav className="adir-pages" aria-label={t("Sayfalar")}>
        {page > 1 && <Link className="outline-button" href={pageHref(page - 1)}>{t("Önceki")}</Link>}<span>{page} / {pages}</span>{page < pages && <Link className="outline-button" href={pageHref(page + 1)}>{t("Sonraki")}</Link>}</nav>}
    </div>
  </main>;
}
