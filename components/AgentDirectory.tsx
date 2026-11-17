"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { BadgeCheck, Languages, MapPin, Phone, Search, Users } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import { AGENT_LANGUAGES, AGENTS_PER_PAGE, type AgentCard, type AgentLanguage, type AgentQuery } from "@/lib/agent-directory";

// /danismanlar: estate agents with published listings (lib/agent-directory.ts). Filters are a GET form, so
// every filtered page has its own address and is rendered on the server.
export function useLanguageName() {
  const { locale } = useLocale();
  const names = (() => { try { return new Intl.DisplayNames([locale], { type: "language" }); } catch { return null; } })();
  return (code: string) => { const name = names?.of(code) || code; return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1); };
}

function PhoneButton({ id }: { id: string }) {
  const { t } = useLocale();
  const [phone, setPhone] = useState<string | null>(null), [error, setError] = useState(false);
  if (phone) return <a className="primary-button" href={`tel:${phone}`}><Phone size={15} aria-hidden="true"/><bdi>{phone}</bdi></a>;
  return <button type="button" className="outline-button" onClick={() => fetch(`/api/agents?phone=${id}`).then((response) => apiJson<{ phone?: string }>(response)).then((data) => data.phone ? setPhone(data.phone) : setError(true)).catch(() => setError(true))}>
    <Phone size={15} aria-hidden="true"/>{t(error ? "Telefon numarası yok" : "Telefonu göster")}</button>;
}

function Card({ agent }: { agent: AgentCard }) {
  const { t, locale } = useLocale(), language = useLanguageName();
  return <article className="agent-card">
    <div className="agent-card-head">
      {agent.avatarUrl ? <img className="agent-card-photo" src={agent.avatarUrl} alt="" loading="lazy"/> : <span className="agent-card-photo" aria-hidden="true">{agent.name.charAt(0).toLocaleUpperCase(locale)}</span>}
      <div><h2>{agent.name}</h2>{agent.company && <p>{agent.company}</p>}
        {agent.city && <p><MapPin size={12} aria-hidden="true"/> {agent.city}{agent.district ? ` / ${agent.district}` : ""}</p>}
        {agent.verified && <span className="agent-verified"><BadgeCheck size={13} aria-hidden="true"/>{t("Belgesi doğrulanmış")}</span>}</div>
    </div>
    <div className="agent-card-facts">
      <span>{t("{n} ilan").replace("{n}", new Intl.NumberFormat(locale).format(agent.listings))}</span>
      {agent.languages.length > 0 && <span title={agent.languages.map(language).join(", ")}><Languages size={12} aria-hidden="true"/> {agent.languages.slice(0, 3).map(language).join(", ")}{agent.languages.length > 3 ? ` +${agent.languages.length - 3}` : ""}</span>}
    </div>
    <div className="agent-card-actions"><PhoneButton id={agent.id}/><Link className="outline-button" href={`/profil/${agent.id}`}>{t("Profili ve ilanları gör")}</Link></div>
  </article>;
}

export function AgentDirectory({ query, total, agents }: { query: AgentQuery; total: number; agents: AgentCard[] }) {
  const { t, locale } = useLocale(), language = useLanguageName();
  const [city, setCity] = useState(query.city || "");
  useEffect(() => setCity(query.city || ""), [query.city]);
  const page = query.page || 1, pages = Math.max(1, Math.ceil(total / AGENTS_PER_PAGE));
  const href = (next: number) => { const params = new URLSearchParams(Object.entries({ il: query.city, ilce: query.district, dil: query.language, q: query.q }).filter(([, value]) => value) as [string, string][]); if (next > 1) params.set("sayfa", String(next)); const text = params.toString(); return `/danismanlar${text ? `?${text}` : ""}`; };
  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Users size={15} aria-hidden="true"/> {t("DANIŞMAN BUL")}</span>
      <h1>{t("Gayrimenkul danışmanları")}</h1>
      <p>{t("Bölgenizdeki emlak danışmanlarını ilan sayıları ve konuştukları dillerle inceleyin; size uygun uzmana doğrudan ulaşın.")}</p>
    </div></section>
    <div className="container">
      <form className="agents-filters" method="get" action="/danismanlar">
        <label className="tool-field"><span>{t("İl")}</span><select name="il" value={city} onChange={(event) => setCity(event.target.value)}><option value="">{t("Tümü")}</option>{CITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="tool-field"><span>{t("İlçe")}</span><select name="ilce" defaultValue={query.district || ""} disabled={!city} key={city}><option value="">{t("Tümü")}</option>{(DISTRICTS[city] || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="tool-field"><span>{t("Konuştuğu dil")}</span><select name="dil" defaultValue={query.language || ""}><option value="">{t("Tümü")}</option>{AGENT_LANGUAGES.map((code: AgentLanguage) => <option key={code} value={code}>{language(code)}</option>)}</select></label>
        <label className="tool-field"><span>{t("Ad veya ofis")}</span><input name="q" maxLength={80} defaultValue={query.q || ""}/></label>
        <button type="submit" className="primary-button"><Search size={16} aria-hidden="true"/>{t("Ara")}</button>
      </form>
      <p className="agents-count"><strong>{t("Gayrimenkul danışmanları")}</strong> · {t("{n} danışman bulundu").replace("{n}", new Intl.NumberFormat(locale).format(total))}</p>
      {agents.length ? <div className="agents-grid">{agents.map((agent) => <Card key={agent.id} agent={agent}/>)}</div>
        : <div className="agents-empty"><p>{t("Bu ölçütlere uygun danışman bulunamadı.")}</p><p><Link href="/benim-icin-bul">{t("Benim için bul formuyla talebinizi bırakın")}</Link></p></div>}
      {pages > 1 && <nav className="tools-tabs" aria-label={t("Sayfalar")} style={{ justifyContent: "center", marginTop: 24 }}>
        {page > 1 && <Link className="outline-button" href={href(page - 1)}>{t("Önceki")}</Link>}<span className="agents-count">{page} / {pages}</span>{page < pages && <Link className="outline-button" href={href(page + 1)}>{t("Sonraki")}</Link>}</nav>}
    </div>
  </main>;
}
