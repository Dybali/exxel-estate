"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Bell, Clock, Crown, Flame, Globe2, Inbox, Lock, Mail, MapPin, MessageCircle, Phone, RefreshCw, Send, ShieldCheck, Sparkles, Timer, Zap } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { CITIES } from "@/lib/turkey-locations";
import { HOME_CONTACT, HOME_CONTACT_TIMES, HOME_PAYMENTS, HOME_TIMELINES, HOME_TYPES } from "@/lib/home-requests";
import type { BoardItem, LeadAccess } from "@/lib/lead-board";
import type { Listing } from "@/lib/listings";
import { FeatureTip } from "@/components/FeatureTip";
import { InfoTip } from "@/components/InfoTip";

// Hesabım › "Talep akışı" (lib/lead-board.ts): the bulletin of every open "Benim için bul" request, the premium
// feed agents follow with a Profesyonel or Prestij package (owner's request 2026-11-24). The agent filters, picks
// and reaches the buyer with an offer or by opening the phone number; at most 4 agents per request.
type Summary = { fresh: number; hot: number; foreign: number; open: number };
type Board = { items: BoardItem[]; total: number; page: number; pageSize: number; access: LeadAccess; stats: { answered: number; medianHours: number | null; fast: boolean }; follows: string[]; summary?: Summary };
const CATEGORY: Record<string, string> = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" };
const PER_REQUEST = 4;
const DAY = 86_400_000;

function ago(value: string, t: (key: string) => string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return t("{n} dk önce").replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  return hours < 24 ? t("{n} sa önce").replace("{n}", String(hours)) : t("{n} gün önce").replace("{n}", String(Math.round(hours / 24)));
}

function Slots({ reached }: { reached: number }) {
  const { t } = useLocale();
  return <span className="lb-slots" title={t("{n}/{max} danışman ulaştı").replace("{n}", String(reached)).replace("{max}", String(PER_REQUEST))}>
    {Array.from({ length: PER_REQUEST }, (_, i) => <i key={i} className={i < reached ? "on" : ""}/>)}
    <small>{t("{n}/{max} danışman ulaştı").replace("{n}", String(reached)).replace("{max}", String(PER_REQUEST))}</small>
  </span>;
}

function Card({ item, listings, plans, onDone }: { item: BoardItem; listings: Listing[]; plans: boolean; onDone: () => void }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false), [message, setMessage] = useState(""), [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const d = item.details;
  const districts = d?.districts.length ? d.districts.join(", ") : item.district;
  const types = (d?.types || []).map((value) => t(HOME_TYPES[item.category]?.find((type) => type.value === value)?.label || value)).join(", ");
  const reached = Boolean(item.contact), fresh = Date.now() - Date.parse(item.createdAt) < DAY;
  async function post(payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/lead-board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await apiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      setOpen(false); setMessage(""); setChosen([]); onDone();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const tags = [
    d?.timeline ? { key: "time", label: t(HOME_TIMELINES[d.timeline]), icon: Timer, tone: "" } : null,
    d?.payment ? { key: "pay", label: t(HOME_PAYMENTS[d.payment]), icon: null, tone: d.payment === "cash" || d.payment === "approved" ? "good" : "" } : null,
    d?.foreign ? { key: "foreign", label: `${t(d.citizenship ? "Yabancı alıcı · vatandaşlık amaçlı" : "Yabancı alıcı")} · ${new Intl.DisplayNames([locale], { type: "language" }).of(d.language) || d.language}`, icon: Globe2, tone: "info" } : null,
    d?.minArea ? { key: "area", label: `${t("en az")} ${new Intl.NumberFormat(locale).format(d.minArea)} m²`, icon: null, tone: "" } : null,
    ...(d?.features || []).slice(0, 4).map((feature) => ({ key: `f-${feature}`, label: t(feature), icon: null, tone: "" })),
  ].filter(Boolean) as { key: string; label: string; icon: typeof Flame | null; tone: string }[];
  return <article className={`lb-card${item.hot ? " hot" : ""}${item.locked && !reached ? " locked" : ""}${reached ? " engaged" : ""}`}>
    <div className="lb-card-main">
      <div className="lb-card-top">
        <span className={`lb-intent ${item.intent}`}>{t(item.intent === "buy" ? "Satın almak istiyor" : "Kiralamak istiyor")}</span>
        {item.hot && <span className="lb-badge hot"><Flame size={12} aria-hidden="true"/>{t("Sıcak")}</span>}
        {fresh && <span className="lb-badge new">{t("Yeni")}</span>}
        <time dateTime={item.createdAt}><Clock size={12} aria-hidden="true"/>{ago(item.createdAt, t)}</time>
      </div>
      <h4>{types || t(CATEGORY[item.category] || item.category)}{item.rooms && <> · {item.rooms.split(",").join(" / ")}</>}</h4>
      <p className="lb-where"><MapPin size={14} aria-hidden="true"/>{districts ? `${districts}, ` : ""}{item.city}</p>
      <p className="lb-budget">{item.budgetMin || item.budgetMax ? <>{item.budgetMin ? <Money value={item.budgetMin} currency="TRY"/> : "…"} – {item.budgetMax ? <Money value={item.budgetMax} currency="TRY"/> : "…"}{item.intent === "rent" ? ` ${t("/ ay")}` : ""}</> : t("Bütçe belirtilmedi")}</p>
      {tags.length > 0 && <ul className="lb-tags">{tags.map(({ key, label, icon: Icon, tone }) => <li key={key} className={tone}>{Icon && <Icon size={12} aria-hidden="true"/>}{label}</li>)}</ul>}

      {reached && item.contact && <div className="lb-contact">
        <div><strong>{item.contact.name}</strong>{d && <span>{t("İletişim")}: {t(HOME_CONTACT[d.contact])}{d.contact !== "email" && d.contactTime !== "any" ? ` · ${t(HOME_CONTACT_TIMES[d.contactTime])}` : ""}</span>}</div>
        {item.note && <p dir="auto">“{item.note}”</p>}
        <div className="lb-actions">
          {item.contact.phone && <a className="outline-button" href={`tel:${item.contact.phone}`}><Phone size={15}/><bdi>{item.contact.phone}</bdi></a>}
          {item.contact.phone && <a className="outline-button" href={whatsappHref(item.contact.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>WhatsApp</a>}
          {item.contact.email && <a className="outline-button" href={`mailto:${item.contact.email}`}><Mail size={15}/>{item.contact.email}</a>}
          {!item.mine?.revealed && <button type="button" className="outline-button" disabled={busy} onClick={() => void post({ action: "reveal", id: item.id })}><Phone size={15}/>{t("Telefonu aç")}</button>}
        </div>
        {item.mine?.offer && <p className="lb-sent"><ShieldCheck size={14} aria-hidden="true"/>{t("Teklifiniz gönderildi")} · {ago(item.mine.offer.createdAt, t)}</p>}
      </div>}

      {open && <div className="lb-offer">
        <label className="tool-field"><span>{t("Mesajınız")}</span><textarea maxLength={1000} minLength={20} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Kendinizi tanıtın ve neler sunabileceğinizi yazın.")}/></label>
        {listings.length > 0 && <div className="tool-field"><span>{t("İlan ekleyin (en fazla 3)")}</span><ul className="lead-listings">{listings.slice(0, 30).map((listing) => {
          const on = chosen.includes(listing.id), full = !on && chosen.length >= 3;
          return <li key={listing.id}><label className={on ? "active" : ""}><input type="checkbox" checked={on} disabled={full} onChange={() => setChosen((old) => on ? old.filter((id) => id !== listing.id) : [...old, listing.id])}/>{listing.title} · {listing.district}, {listing.city}</label></li>;
        })}</ul></div>}
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="lb-actions"><button type="button" className="small-primary" disabled={busy || message.trim().length < 20} onClick={() => void post({ action: "offer", id: item.id, message, listingIds: chosen })}>{t(busy ? "Gönderiliyor..." : "Teklifi gönder")}</button><button type="button" className="outline-button" onClick={() => setOpen(false)}>{t("Vazgeç")}</button></div>
      </div>}
      {!open && error && <p className="form-error" role="alert">{t(error)}</p>}
    </div>

    <aside className="lb-card-side">
      <Slots reached={item.reached}/>
      {!reached && (item.locked ? <div className="lb-locked"><Lock size={15} aria-hidden="true"/><span>{t(plans ? "Bu talebe ulaşmak için Profesyonel veya Prestij paketi gerekir; yeni talepler ilk 24 saat Prestij danışmanlarına açıktır." : "Bu talebe şu an ulaşamazsınız.")}</span>{plans && <Link className="small-primary" href="/paketler">{t("Paketleri gör")}</Link>}</div>
        : item.full ? <p className="lb-full">{t("Dolu: 4 danışman ulaştı")}</p>
        : <div className="lb-side-actions">
          <button type="button" className="small-primary" onClick={() => setOpen((value) => !value)}><Send size={15}/>{t("Teklif gönder")}</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void post({ action: "reveal", id: item.id })}><Phone size={15}/>{t("Telefonu aç")}</button>
        </div>)}
    </aside>
  </article>;
}

export function LeadBoard() {
  const { t } = useLocale();
  const [board, setBoard] = useState<Board | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ city: "", intent: "", category: "", hot: false, foreign: false, mine: false });
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [follow, setFollow] = useState<string[] | null>(null), [followOpen, setFollowOpen] = useState(false), [followSaved, setFollowSaved] = useState(false);
  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value === true ? "1" : String(value));
    setLoading(true);
    return fetch(`/api/lead-board?${params}`, { cache: "no-store" }).then((response) => apiJson<Board & { error?: string }>(response).then((data) => { if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi."); setBoard(data); setError(""); setFollow((old) => old ?? data.follows); }))
      .catch((cause) => setError((cause as Error).message)).finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetch("/api/mine").then((response) => response.ok ? response.json() as Promise<{ listings?: Listing[] }> : { listings: [] }).then((data) => setListings((data.listings || []).filter((item) => item.status === "published"))).catch(() => {}); }, []);
  const set = (key: keyof typeof filters, value: string | boolean) => { setPage(1); setFilters((old) => ({ ...old, [key]: value })); };
  async function saveFollow() {
    const response = await fetch("/api/lead-board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow", cities: follow || [] }) });
    if (!response.ok) setError((await apiJson<{ error?: string }>(response)).error || "Kaydedilemedi."); else { setFollowOpen(false); setFollowSaved(true); }
  }
  const access = board?.access, summary = board?.summary;
  const planName = !access?.plans ? null : access.plan === "prestige" ? "Prestij" : access.plan === "professional" ? "Profesyonel" : null;
  const quota = access?.limit != null && access.limit > 0 ? Math.min(100, Math.round(access.used / access.limit * 100)) : null;
  return <section id="talep-akisi" className="lb">
    <header className="lb-hero">
      <div className="lb-hero-text">
        <span className="lb-kicker"><Sparkles size={14} aria-hidden="true"/>{t("BENİM İÇİN BUL · TALEP BÜLTENİ")}</span>
        <h3>{t("Ev arayan alıcılar, ilk siz ulaşın")}</h3>
        <p>{t("Alıcılar ne aradığını, bütçesini ve ne zaman taşınacağını anlatır. Size uyan talebe teklif gönderin veya telefonu açın; bir talebe en fazla 4 danışman ulaşabilir, hızlı olan kazanır.")}</p>
      </div>
      <div className={`lb-plan ${access?.plan || "free"}`}>
        <span className="lb-plan-name">{access?.plan === "prestige" ? <Crown size={16} aria-hidden="true"/> : <ShieldCheck size={16} aria-hidden="true"/>}{planName ? t("{plan} paketi").replace("{plan}", planName) : t(access?.plans ? "Paketiniz yok" : "Herkese açık dönem")}</span>
        {access?.limit != null ? <><strong>{access.used} / {access.limit}</strong><small>{t("bu ay ulaştığınız talep")}</small>{quota !== null && <div className="lb-quota"><i style={{ width: `${quota}%` }}/></div>}</>
          : <><strong>{access?.used ?? 0}</strong><small>{t("bu ay ulaştığınız talep")}</small></>}
        {access?.plans && access.plan !== "prestige" && <Link href="/paketler" className="lb-upgrade">{t(access.plan ? "Prestij'e geçin: ilk 24 saat sizin" : "Paketleri gör")}</Link>}
        {access?.plans && access.headStart && <span className="lb-headstart"><Zap size={13} aria-hidden="true"/>{t("Yeni talepler ilk 24 saat size açık")}</span>}
      </div>
    </header>
    <FeatureTip id="talep-akisi" title="Talep akışı nasıl çalışır?" text="Ev arayan üyelerin talepleri burada en yenisi üstte görünür. Beğendiğiniz talebe teklif gönderin veya telefonu açın; bir talebe en fazla 4 danışman ulaşabilir, hızlı olan kazanır."/>

    {board && <div className="lb-kpis">
      <div><span>{t("Açık talep")}</span><strong>{board.total}</strong><small>{t("{n} talepte hâlâ yer var").replace("{n}", String(summary?.open ?? board.total))}</small></div>
      <div><span>{t("Son 24 saatte yeni")}</span><strong>{summary?.fresh ?? 0}</strong><small>{t("en yeni üstte")}</small></div>
      <div className="hot"><span>{t("Sıcak talep")}</span><strong>{summary?.hot ?? 0}</strong><small>{t("hemen alacak veya nakit ödeyecek")}</small></div>
      <div><span>{t("Ortalama dönüşünüz")}</span><strong>{board.stats.medianHours == null ? "—" : board.stats.medianHours < 1 ? t("1 saatten az") : t("{n} sa").replace("{n}", String(Math.round(board.stats.medianHours)))}</strong>{board.stats.fast ? <small className="lb-fast"><Zap size={12} aria-hidden="true"/>{t("Hızlı yanıt rozeti")}</small> : <small>{t("{n} talebe ulaştınız").replace("{n}", String(board.stats.answered))}</small>}</div>
    </div>}

    <div className="lb-layout">
      <div className="lb-feed">
        <div className="lb-filters">
          <div className="lb-seg" role="group" aria-label={t("İlan türü")}>{([["", "Tümü"], ["buy", "Satılık"], ["rent", "Kiralık"]] as const).map(([value, label]) => <button key={value || "all"} type="button" className={filters.intent === value ? "active" : ""} aria-pressed={filters.intent === value} onClick={() => set("intent", value)}>{t(label)}</button>)}</div>
          <select aria-label={t("İl")} value={filters.city} onChange={(event) => set("city", event.target.value)}><option value="">{t("Tüm iller")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select>
          <select aria-label={t("Kategori")} value={filters.category} onChange={(event) => set("category", event.target.value)}><option value="">{t("Tüm kategoriler")}</option>{Object.entries(CATEGORY).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
          {([["hot", "Sıcak"], ["foreign", "Yabancı alıcı"], ["mine", "Ulaştıklarım"]] as const).map(([key, label]) => <button key={key} type="button" className={`lb-chip${filters[key] ? " active" : ""}`} aria-pressed={filters[key]} onClick={() => set(key, !filters[key])}>{key === "hot" && <Flame size={13} aria-hidden="true"/>}{key === "foreign" && <Globe2 size={13} aria-hidden="true"/>}{t(label)}</button>)}
          <InfoTip label="Sıcak talep" text="Hemen almak veya taşınmak isteyen, ya da nakit veya onaylı krediyle ödeyecek alıcıların talepleri. Kartta alev simgesiyle işaretlenir."/>
          <button type="button" className="lb-refresh" onClick={() => void load()} aria-label={t("Yenile")} title={t("Yenile")} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/></button>
        </div>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        {!board ? !error && <div className="lb-skeleton" aria-busy="true"/> : !board.items.length ? <div className="lb-empty"><Inbox size={28} aria-hidden="true"/><strong>{t("Bu filtrelerle açık talep yok.")}</strong><p>{t("Takip ettiğiniz illerde yeni talep gelince size e-posta göndeririz.")}</p></div>
          : <div className="lb-list">{board.items.map((item) => <Card key={item.id} item={item} listings={listings} plans={Boolean(access?.plans)} onDone={() => void load()}/>)}</div>}
        {board && board.total > board.pageSize && <div className="lb-pages">
          <button type="button" className="outline-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("Önceki")}</button>
          <span>{page} / {Math.ceil(board.total / board.pageSize)}</span>
          <button type="button" className="outline-button" disabled={page * board.pageSize >= board.total} onClick={() => setPage((value) => value + 1)}>{t("Sonraki")}</button>
        </div>}
      </div>

      <aside className="lb-rail">
        <section className="lb-rail-card">
          <h4><Bell size={16} aria-hidden="true"/>{t("Takip ettiğim iller")}</h4>
          <p>{t("Seçtiğiniz illerde yeni talep gelince e-posta alırsınız. Boş bırakırsanız ilanlarınızın bulunduğu iller kullanılır. En fazla 10 il.")}</p>
          {follow && follow.length > 0 && !followOpen && <ul className="lb-follow-list">{follow.map((city) => <li key={city}>{city}</li>)}</ul>}
          {followOpen ? <>
            <div className="lb-follow-chips">{CITIES.map((city) => { const on = (follow || []).includes(city); return <button key={city} type="button" className={on ? "active" : ""} aria-pressed={on} disabled={!on && (follow || []).length >= 10} onClick={() => setFollow((old) => on ? (old || []).filter((item) => item !== city) : [...(old || []), city])}>{city}</button>; })}</div>
            <div className="lb-actions"><button type="button" className="small-primary" onClick={() => void saveFollow()}>{t("Kaydet")}</button><button type="button" className="outline-button" onClick={() => setFollowOpen(false)}>{t("Vazgeç")}</button></div>
          </> : <button type="button" className="outline-button" onClick={() => { setFollowOpen(true); setFollowSaved(false); }}>{t(follow?.length ? "İlleri düzenle" : "İl seçin")}</button>}
          {followSaved && <p className="lb-sent" role="status">{t("Kaydedildi.")}</p>}
        </section>
        <section className="lb-rail-card">
          <h4><Zap size={16} aria-hidden="true"/>{t("Kazanmanın yolu")}</h4>
          <ol className="lb-tips">
            <li>{t("İlk birkaç saatte ulaşın: alıcı ilk gelen tekliflere bakar.")}</li>
            <li>{t("Teklife uygun 1–3 ilanınızı ekleyin; boş teklif daha az okunur.")}</li>
            <li>{t("Kısa ve kişisel yazın: bölgeyi, fiyatı ve ne zaman gösterebileceğinizi söyleyin.")}</li>
          </ol>
        </section>
      </aside>
    </div>
  </section>;
}
