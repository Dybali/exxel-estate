"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { Bell, Flame, Globe2, Inbox, Lock, Mail, MessageCircle, Phone, Send, Timer, Zap } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { Money, useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { CITIES } from "@/lib/turkey-locations";
import { HOME_CONTACT, HOME_CONTACT_TIMES, HOME_PAYMENTS, HOME_TIMELINES, HOME_TYPES } from "@/lib/home-requests";
import type { BoardItem, LeadAccess } from "@/lib/lead-board";
import type { Listing } from "@/lib/listings";

// Hesabım › CRM › "Talep akışı" (lib/lead-board.ts): every open "Benim için bul" request as a feed. The agent
// filters, picks and reaches the member with an offer or by opening the phone number; at most 4 agents per request.
type Board = { items: BoardItem[]; total: number; page: number; pageSize: number; access: LeadAccess; stats: { answered: number; medianHours: number | null; fast: boolean }; follows: string[] };
const CATEGORY: Record<string, string> = { konut: "Konut", arsa: "Arsa", isyeri: "İş yeri" };
const PER_REQUEST = 4;

function ago(value: string, t: (key: string) => string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 60) return t("{n} dk önce").replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  return hours < 24 ? t("{n} sa önce").replace("{n}", String(hours)) : t("{n} gün önce").replace("{n}", String(Math.round(hours / 24)));
}

function Card({ item, listings, plans, onDone }: { item: BoardItem; listings: Listing[]; plans: boolean; onDone: () => void }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false), [message, setMessage] = useState(""), [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const d = item.details;
  const districts = d?.districts.length ? d.districts.join(", ") : item.district;
  const types = (d?.types || []).map((value) => t(HOME_TYPES[item.category]?.find((type) => type.value === value)?.label || value)).join(", ");
  const reached = Boolean(item.contact);
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
    item.hot ? { key: "hot", label: t("Sıcak"), icon: Flame, tone: "hot" } : null,
    d?.timeline ? { key: "time", label: t(HOME_TIMELINES[d.timeline]), icon: Timer, tone: "" } : null,
    d?.payment ? { key: "pay", label: t(HOME_PAYMENTS[d.payment]), icon: null, tone: d.payment === "cash" || d.payment === "approved" ? "good" : "" } : null,
    d?.foreign ? { key: "foreign", label: `${t(d.citizenship ? "Yabancı alıcı · vatandaşlık amaçlı" : "Yabancı alıcı")} · ${new Intl.DisplayNames([locale], { type: "language" }).of(d.language) || d.language}`, icon: Globe2, tone: "info" } : null,
  ].filter(Boolean) as { key: string; label: string; icon: typeof Flame | null; tone: string }[];
  return <article className={`lead-card${item.hot ? " hot" : ""}${item.locked && !reached ? " locked" : ""}`}>
    <header>
      <strong>{item.hot && <Flame size={16} aria-hidden="true"/>}{t(item.intent === "buy" ? "Satılık" : "Kiralık")} {types || t(CATEGORY[item.category] || item.category)} · {districts ? `${districts}, ` : ""}{item.city}{item.rooms && <> · {item.rooms.split(", ").map((room) => t(room)).join(", ")}</>}</strong>
      <span>{ago(item.createdAt, t)}</span>
    </header>
    <p className="lead-meta">
      {item.budgetMin || item.budgetMax ? <>{item.budgetMin ? <Money value={item.budgetMin} currency="TRY"/> : "…"} – {item.budgetMax ? <Money value={item.budgetMax} currency="TRY"/> : "…"}{item.intent === "rent" ? ` ${t("/ ay")}` : ""}</> : t("Bütçe belirtilmedi")}
      {d?.minArea ? <> · {t("en az")} {new Intl.NumberFormat(locale).format(d.minArea)} m²</> : null}
      {d?.features.length ? <> · {d.features.map((feature) => t(feature)).join(", ")}</> : null}
    </p>
    {tags.length > 0 && <ul className="lead-tags">{tags.map(({ key, label, icon: Icon, tone }) => <li key={key} className={tone}>{Icon && <Icon size={13} aria-hidden="true"/>}{label}</li>)}</ul>}
    <p className="lead-slots">{t("{n}/{max} danışman ulaştı").replace("{n}", String(item.reached)).replace("{max}", String(PER_REQUEST))}{item.full && !reached ? ` · ${t("Dolu")}` : ""}</p>

    {reached && item.contact && <div className="lead-contact">
      <strong>{item.contact.name}</strong>
      {d && <span>{t("İletişim")}: {t(HOME_CONTACT[d.contact])}{d.contact !== "email" && d.contactTime !== "any" ? ` · ${t(HOME_CONTACT_TIMES[d.contactTime])}` : ""}</span>}
      {item.note && <p dir="auto">{item.note}</p>}
      <div className="project-editor-actions">
        {item.contact.phone && <a className="outline-button" href={`tel:${item.contact.phone}`}><Phone size={15}/><bdi>{item.contact.phone}</bdi></a>}
        {item.contact.phone && <a className="outline-button" href={whatsappHref(item.contact.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>WhatsApp</a>}
        {item.contact.email && <a className="outline-button" href={`mailto:${item.contact.email}`}><Mail size={15}/>{item.contact.email}</a>}
        {!item.mine?.revealed && <button type="button" className="outline-button" disabled={busy} onClick={() => void post({ action: "reveal", id: item.id })}><Phone size={15}/>{t("Telefonu aç")}</button>}
      </div>
      {item.mine?.offer && <p className="service-account-meta">{t("Teklifiniz gönderildi")} · {ago(item.mine.offer.createdAt, t)}</p>}
    </div>}

    {!reached && (item.locked ? <div className="lead-locked"><Lock size={15} aria-hidden="true"/><span>{t(plans ? "Bu talebe ulaşmak için Profesyonel veya Prestij paketi gerekir; yeni talepler ilk 24 saat Prestij danışmanlarına açıktır." : "Bu talebe şu an ulaşamazsınız.")}</span>{plans && <Link className="outline-button" href="/paketler">{t("Paketleri gör")}</Link>}</div>
      : !item.full && <div className="project-editor-actions">
        <button type="button" className="small-primary" onClick={() => setOpen((value) => !value)}><Send size={15}/>{t("Teklif gönder")}</button>
        <button type="button" className="outline-button" disabled={busy} onClick={() => void post({ action: "reveal", id: item.id })}><Phone size={15}/>{t("Telefonu aç")}</button>
      </div>)}

    {open && <div className="lead-offer">
      <label className="tool-field"><span>{t("Mesajınız")}</span><textarea maxLength={1000} minLength={20} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Kendinizi tanıtın ve neler sunabileceğinizi yazın.")}/></label>
      {listings.length > 0 && <div className="tool-field"><span>{t("İlan ekleyin (en fazla 3)")}</span><ul className="lead-listings">{listings.slice(0, 30).map((listing) => {
        const on = chosen.includes(listing.id), full = !on && chosen.length >= 3;
        return <li key={listing.id}><label className={on ? "active" : ""}><input type="checkbox" checked={on} disabled={full} onChange={() => setChosen((old) => on ? old.filter((id) => id !== listing.id) : [...old, listing.id])}/>{listing.title} · {listing.district}, {listing.city}</label></li>;
      })}</ul></div>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="project-editor-actions"><button type="button" className="small-primary" disabled={busy || message.trim().length < 20} onClick={() => void post({ action: "offer", id: item.id, message, listingIds: chosen })}>{t(busy ? "Gönderiliyor..." : "Teklifi gönder")}</button><button type="button" className="outline-button" onClick={() => setOpen(false)}>{t("Vazgeç")}</button></div>
    </div>}
    {!open && error && <p className="form-error" role="alert">{t(error)}</p>}
  </article>;
}

export function LeadBoard() {
  const { t } = useLocale();
  const [board, setBoard] = useState<Board | null>(null), [error, setError] = useState("");
  const [filters, setFilters] = useState({ city: "", intent: "", category: "", hot: false, foreign: false, mine: false });
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [follow, setFollow] = useState<string[] | null>(null), [followOpen, setFollowOpen] = useState(false);
  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value === true ? "1" : String(value));
    return fetch(`/api/lead-board?${params}`, { cache: "no-store" }).then((response) => apiJson<Board & { error?: string }>(response).then((data) => { if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi."); setBoard(data); setFollow((old) => old ?? data.follows); }))
      .catch((cause) => setError((cause as Error).message));
  }, [filters, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetch("/api/mine").then((response) => response.ok ? response.json() as Promise<{ listings?: Listing[] }> : { listings: [] }).then((data) => setListings((data.listings || []).filter((item) => item.status === "published"))).catch(() => {}); }, []);
  const set = (key: keyof typeof filters, value: string | boolean) => { setPage(1); setFilters((old) => ({ ...old, [key]: value })); };
  async function saveFollow() {
    const response = await fetch("/api/lead-board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow", cities: follow || [] }) });
    if (!response.ok) setError((await apiJson<{ error?: string }>(response)).error || "Kaydedilemedi."); else setFollowOpen(false);
  }
  const access = board?.access;
  return <section id="talep-akisi" className="svc-tool-card lead-board">
    <div className="svc-tool-head"><Inbox size={20} aria-hidden="true"/><div><h3>{t("Talep akışı")}</h3><p>{t("\"Benim için bul\" ile ev arayan üyeler. Herkese açık bir pano: istediğiniz talebi seçin, teklif gönderin veya telefonu açın. Bir talebe en fazla 4 danışman ulaşabilir.")}</p></div></div>
    {board && <div className="lead-stats">
      <div><span>{t("Açık talep")}</span><strong>{board.total}</strong></div>
      <div><span>{t("Bu ay ulaştığınız")}</span><strong>{access?.limit != null ? `${access.used} / ${access.limit}` : access?.used}</strong></div>
      <div><span>{t("Ortalama dönüşünüz")}</span><strong>{board.stats.medianHours == null ? "—" : board.stats.medianHours < 1 ? t("1 saatten az") : t("{n} sa").replace("{n}", String(Math.round(board.stats.medianHours)))}</strong>{board.stats.fast && <small className="lead-fast"><Zap size={12} aria-hidden="true"/>{t("Hızlı yanıt")}</small>}</div>
      <div><span>{t("Paket")}</span><strong>{!access?.plans ? t("Herkese açık") : access.plan === "prestige" ? "Prestij" : access.plan === "professional" ? "Profesyonel" : t("Ücretsiz")}</strong></div>
    </div>}
    <div className="lead-filters">
      <select aria-label={t("İl")} value={filters.city} onChange={(event) => set("city", event.target.value)}><option value="">{t("Tüm iller")}</option>{CITIES.map((city) => <option key={city} value={city}>{city}</option>)}</select>
      <select aria-label={t("İlan türü")} value={filters.intent} onChange={(event) => set("intent", event.target.value)}><option value="">{t("Satılık ve kiralık")}</option><option value="buy">{t("Satılık")}</option><option value="rent">{t("Kiralık")}</option></select>
      <select aria-label={t("Kategori")} value={filters.category} onChange={(event) => set("category", event.target.value)}><option value="">{t("Tüm kategoriler")}</option>{Object.entries(CATEGORY).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
      {([["hot", "Sıcak"], ["foreign", "Yabancı alıcı"], ["mine", "Ulaştıklarım"]] as const).map(([key, label]) => <button key={key} type="button" className={filters[key] ? "active" : ""} aria-pressed={filters[key]} onClick={() => set(key, !filters[key])}>{t(label)}</button>)}
      <button type="button" className="lead-follow-toggle" onClick={() => setFollowOpen((value) => !value)}><Bell size={15} aria-hidden="true"/>{t("Takip ettiğim iller")}{follow?.length ? ` (${follow.length})` : ""}</button>
    </div>
    {followOpen && <div className="lead-follow">
      <p>{t("Seçtiğiniz illerde yeni talep gelince e-posta alırsınız. Boş bırakırsanız ilanlarınızın bulunduğu iller kullanılır. En fazla 10 il.")}</p>
      <div className="request-chips">{CITIES.map((city) => { const on = (follow || []).includes(city); return <button key={city} type="button" className={on ? "active" : ""} aria-pressed={on} disabled={!on && (follow || []).length >= 10} onClick={() => setFollow((old) => on ? (old || []).filter((item) => item !== city) : [...(old || []), city])}>{city}</button>; })}</div>
      <div className="project-editor-actions"><button type="button" className="small-primary" onClick={() => void saveFollow()}>{t("Kaydet")}</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {!board ? !error && <p>{t("Yükleniyor...")}</p> : !board.items.length ? <div className="panel-empty"><Inbox size={26}/><p>{t("Bu filtrelerle açık talep yok.")}</p></div>
      : board.items.map((item) => <Card key={item.id} item={item} listings={listings} plans={Boolean(access?.plans)} onDone={() => void load()}/>)}
    {board && board.total > board.pageSize && <div className="lead-pages">
      <button type="button" className="outline-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("Önceki")}</button>
      <span>{page} / {Math.ceil(board.total / board.pageSize)}</span>
      <button type="button" className="outline-button" disabled={page * board.pageSize >= board.total} onClick={() => setPage((value) => value + 1)}>{t("Sonraki")}</button>
    </div>}
  </section>;
}
