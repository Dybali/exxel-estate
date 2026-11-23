"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowDownRight, ArrowUpRight, Bell, BookmarkCheck, CalendarDays, ChevronRight, CircleHelp, Clock, Eye, FileText, Heart, Inbox, LayoutList, MessageCircle, Phone, Plus, RefreshCw, Search, Sparkles, TrendingUp, UserRound } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { DisplayMoney } from "@/components/DisplayCurrency";
import { ADVICE } from "@/components/CrmStats";
import { PROPERTY_TYPES } from "@/lib/listings";
import type { Overview, OverviewListing } from "@/lib/agent-overview";

// Hesabım › Genel Bakış for estate agents (lib/agent-overview.ts, owner's request 2026-11-23): key figures, a
// performance chart, the listing drawing most interest, the sales funnel, today's to-dos, upcoming viewings, the
// listing table, recent customers and visitor languages. Real data only.
export type OverviewTarget = "messages" | "requests" | "crm" | "listings" | "appointments";
const PERIODS = [7, 30, 90] as const;
const FLAG: Record<string, string> = { tr: "tr", en: "gb", de: "de", fr: "fr", ar: "sa", fa: "ir", ru: "ru", nl: "nl", es: "es", it: "it" };
const STATUS: Record<string, string> = { published: "Yayında", pending: "İncelemede", expired: "Süresi doldu", rejected: "Reddedildi", draft: "Taslak" };
const typeLabel = (value: string) => PROPERTY_TYPES.find((item) => item.value === value)?.label || value;

function Change({ now, before }: { now: number; before: number }) {
  const { t } = useLocale();
  if (!before && !now) return <span className="ov-change flat">—</span>;
  if (!before) return <span className="ov-change up"><ArrowUpRight size={13} aria-hidden="true"/>{t("yeni")}</span>;
  const change = Math.round((now - before) / before * 100);
  return <span className={`ov-change ${change >= 0 ? "up" : "down"}`} title={t("Önceki döneme göre")}>{change >= 0 ? <ArrowUpRight size={13} aria-hidden="true"/> : <ArrowDownRight size={13} aria-hidden="true"/>}%{Math.abs(change)}</span>;
}

function Chart({ series }: { series: Overview["series"] }) {
  const { t, locale } = useLocale();
  const [hover, setHover] = useState<number | null>(null);
  const width = 640, height = 220, padX = 34, padY = 16, bottom = 26;
  const peak = Math.max(4, ...series.map((day) => day.views), ...series.map((day) => day.contacts));
  const step = Math.pow(10, Math.floor(Math.log10(peak))), top = Math.ceil(peak / step) * step;
  const x = (i: number) => padX + (series.length < 2 ? 0 : i * (width - padX * 2) / (series.length - 1));
  const y = (value: number) => padY + (height - padY - bottom) * (1 - value / top);
  const line = (key: "views" | "contacts") => series.map((day, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(day[key]).toFixed(1)}`).join("");
  const area = `${line("views")}L${x(series.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const date = (day: string, long = false) => new Date(day + "T12:00:00Z").toLocaleDateString(locale, long ? { day: "numeric", month: "long" } : { day: "numeric", month: "short" });
  const labels = series.length ? [0, Math.floor((series.length - 1) / 3), Math.floor((series.length - 1) * 2 / 3), series.length - 1] : [];
  if (!series.length) return <p className="ov-empty">{t("Bu dönemde henüz veri yok.")}</p>;
  const point = hover === null ? null : series[hover];
  return <div className="ov-chart" onMouseLeave={() => setHover(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Günlük görüntülenme ve iletişim grafiği")} preserveAspectRatio="none">
      <defs><linearGradient id="ov-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1d7a5c" stopOpacity=".28"/><stop offset="100%" stopColor="#1d7a5c" stopOpacity="0"/></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((f) => <g key={f}><line x1={padX} x2={width - padX} y1={y(top * f)} y2={y(top * f)} className="ov-grid"/><text x={padX - 8} y={y(top * f) + 4} className="ov-axis" textAnchor="end">{Math.round(top * f)}</text></g>)}
      <path d={area} fill="url(#ov-area)"/>
      <path d={line("views")} className="ov-line views"/>
      <path d={line("contacts")} className="ov-line contacts"/>
      {labels.map((i) => <text key={i} x={x(i)} y={height - 6} className="ov-axis" textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>{date(series[i].day)}</text>)}
      {hover !== null && <><line x1={x(hover)} x2={x(hover)} y1={padY} y2={y(0)} className="ov-cursor"/><circle cx={x(hover)} cy={y(series[hover].views)} r="4.5" className="ov-dot views"/><circle cx={x(hover)} cy={y(series[hover].contacts)} r="4" className="ov-dot contacts"/></>}
      {series.map((_, i) => <rect key={i} x={x(i) - (width - padX * 2) / series.length / 2} y={0} width={(width - padX * 2) / Math.max(1, series.length)} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}/>)}
    </svg>
    {point && <div className="ov-tooltip" style={{ left: `${Math.min(82, Math.max(4, x(hover!) / width * 100 - 9))}%` }}><strong>{date(point.day, true)}</strong><span><i className="views"/>{t("Görüntülenme")}: {point.views}</span><span><i className="contacts"/>{t("İletişim")}: {point.contacts}</span></div>}
  </div>;
}

function Funnel({ totals }: { totals: Overview["totals"] }) {
  const { t } = useLocale();
  const steps = [
    { label: "Görüntülenme", value: totals.views, icon: Eye },
    { label: "Favori", value: totals.favorites, icon: Heart },
    { label: "İletişim", value: totals.contacts, icon: MessageCircle },
    { label: "Randevu", value: totals.appointments, icon: CalendarDays },
  ];
  const conversion = totals.views ? Math.round(totals.contacts / totals.views * 1000) / 10 : 0;
  const ring = 2 * Math.PI * 52, filled = Math.min(1, conversion / 10) * ring; // a full ring is a 10% contact rate
  return <div className="ov-funnel">
    <div className="ov-ring" role="img" aria-label={`${t("İletişime dönüşme oranı")}: %${conversion}`}>
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" className="ov-ring-bg"/><circle cx="60" cy="60" r="52" className="ov-ring-fill" strokeDasharray={`${filled} ${ring}`} transform="rotate(-90 60 60)"/></svg>
      <div><strong>%{conversion}</strong><span>{t("iletişime dönüştü")}</span></div>
    </div>
    <ul>{steps.map((step) => { const Icon = step.icon, share = totals.views ? Math.max(step.value ? 4 : 0, Math.round(step.value / totals.views * 100)) : 0; return <li key={step.label}><span><Icon size={14} aria-hidden="true"/>{t(step.label)}</span><strong>{step.value}</strong><i style={{ width: `${step.label === "Görüntülenme" ? (totals.views ? 100 : 0) : share}%` }}/></li>; })}</ul>
  </div>;
}

function WeekAppointments({ appointments, open }: { appointments: Overview["appointments"]; open: (target: OverviewTarget) => void }) {
  const { t, locale } = useLocale();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const [picked, setPicked] = useState<string | null>(null);
  const byDay = (d: Date) => appointments.filter((a) => key(new Date(a.slotAt)) === key(d));
  const shown = picked ? appointments.filter((a) => key(new Date(a.slotAt)) === picked) : appointments.slice(0, 4);
  return <>
    <div className="ov-week" role="group" aria-label={t("Önümüzdeki 7 gün")}>
      {days.map((d, i) => { const count = byDay(d).length, k = key(d); return <button type="button" key={k} className={`${picked === k ? "active" : ""} ${i === 0 ? "today" : ""}`} aria-pressed={picked === k} onClick={() => setPicked(picked === k ? null : k)}>
        <small>{d.toLocaleDateString(locale, { weekday: "short" })}</small><strong>{d.getDate()}</strong>{count > 0 && <i aria-label={`${count} ${t("randevu")}`}/>}</button>; })}
    </div>
    {shown.length ? <ul className="ov-appointments">{shown.map((a) => { const at = new Date(a.slotAt); return <li key={a.id}>
      <time dateTime={a.slotAt}><strong>{at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</strong><small>{at.toLocaleDateString(locale, { day: "numeric", month: "short" })}</small></time>
      <div><strong>{a.buyerName}</strong><span>{a.listingTitle}</span></div>
      <span className={`ov-pill ${a.status === "confirmed" ? "good" : "warn"}`}>{t(a.status === "confirmed" ? "Onaylandı" : "Onay bekliyor")}</span>
    </li>; })}</ul> : <p className="ov-empty">{t(picked ? "Bu gün randevu yok." : "Önümüzdeki iki haftada randevu yok.")}</p>}
    <button type="button" className="ov-card-link" onClick={() => open("appointments")}>{t("Tüm randevular")}<ChevronRight size={15} aria-hidden="true"/></button>
  </>;
}

export function AgentOverview({ name, open }: { name: string; open: (target: OverviewTarget) => void }) {
  const { t, locale } = useLocale();
  const [days, setDays] = useState<number>(30), [data, setData] = useState<Overview | null>(null), [state, setState] = useState<"loading" | "ready" | "error">("loading"), [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<"all" | "published" | "pending" | "expired">("all"), [query, setQuery] = useState("");
  useEffect(() => {
    const control = new AbortController(); setState((current) => current === "ready" ? "ready" : "loading");
    fetch(`/api/crm/overview?days=${days}`, { cache: "no-store", signal: control.signal }).then((r) => apiJson<Overview>(r)).then((next) => { setData(next); setState("ready"); }).catch(() => { if (!control.signal.aborted) setState("error"); });
    return () => control.abort();
  }, [days, reload]);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const ago = (iso: string) => { const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000), rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }); return minutes < 60 ? rtf.format(-Math.max(1, minutes), "minute") : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), "hour") : rtf.format(-Math.round(minutes / 1440), "day"); };
  const languageName = (code: string) => { try { return new Intl.DisplayNames([locale], { type: "language" }).of(code) || code; } catch { return code; } };
  if (state === "loading" && !data) return <div className="ov" aria-busy="true"><div className="ov-skeleton"/><div className="ov-skeleton tall"/></div>;
  if (!data) return <div className="ov"><div className="ov-card ov-error"><p>{t("Panel verileri şu anda yüklenemedi.")}</p><button type="button" className="outline-button" onClick={() => setReload((n) => n + 1)}><RefreshCw size={15} aria-hidden="true"/>{t("Yeniden dene")}</button></div></div>;
  const { totals, previous, counts, reminders, top } = data;
  const rows = data.listings.filter((row) => (filter === "all" || row.status === filter) && `${row.title} ${row.city} ${row.district}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)));
  const todo = [
    { count: reminders.unanswered, icon: MessageCircle, title: "Yanıt bekleyen müşteriler", text: "24 saatten uzun süredir cevap bekleyen mesajlar", target: "messages" as const, tone: "warn" },
    { count: reminders.pendingAppointments, icon: CalendarDays, title: "Onay bekleyen randevular", text: "Alıcıların istediği yer gösterme saatleri", target: "appointments" as const, tone: "warn" },
    { count: reminders.newRequests, icon: Inbox, title: "Talep akışında yeni talepler", text: "Ev arayan alıcılar; teklif gönderin", target: "requests" as const, tone: "info" },
    { count: reminders.expiringSoon, icon: Clock, title: "Süresi dolmak üzere ilanlar", text: "7 gün içinde yayından kalkacak", target: "listings" as const, tone: "warn" },
    { count: reminders.drafts, icon: FileText, title: "Tamamlanmamış taslaklar", text: "Yayına almak için tamamlayın", target: "listings" as const, tone: "info" },
  ];
  const openTodos = todo.filter((item) => item.count > 0);
  const languageTotal = Object.values(data.languages).reduce((sum, value) => sum + value, 0);
  const languages = Object.entries(data.languages).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const statusPill = (row: OverviewListing) => <span className={`ov-pill ${row.status === "published" ? (row.daysLeft !== null && row.daysLeft <= 7 ? "warn" : "good") : row.status === "pending" ? "info" : "muted"}`}>{t(STATUS[row.status] || row.status)}{row.status === "published" && row.daysLeft !== null ? ` · ${t("{n} gün").replace("{n}", String(row.daysLeft))}` : ""}</span>;
  const scoreClass = (score: number) => score >= 75 ? "good" : score >= 50 ? "mid" : "low";
  return <div className="ov" aria-busy={state === "loading"}>
    <div className="ov-toolbar">
      <div><span className="eyebrow dark-eyebrow">{t("EMLAK YÖNETİMİ")}</span><h2>{t("Performans paneli")}</h2><p>{t("Son {n} günün özeti; yalnızca sizin ilanlarınız.").replace("{n}", String(data.days))}</p></div>
      <div className="ov-toolbar-actions">
        <div className="ov-periods" role="group" aria-label={t("Dönem")}>{PERIODS.map((value) => <button type="button" key={value} className={days === value ? "active" : ""} aria-pressed={days === value} onClick={() => setDays(value)}>{t("{n} gün").replace("{n}", String(value))}</button>)}</div>
        <button type="button" className="ov-icon" onClick={() => setReload((n) => n + 1)} aria-label={t("Yenile")} title={t("Yenile")}><RefreshCw size={17}/></button>
        <button type="button" className="ov-icon" onClick={() => open("messages")} aria-label={t("Mesajlar")} title={t("Mesajlar")}><MessageCircle size={17}/></button>
        <button type="button" className="ov-icon" onClick={() => open("requests")} aria-label={t("Talep akışı")} title={t("Talep akışı")}><Inbox size={17}/></button>
        <Link className="ov-icon" href="/yardim#emlakci" aria-label={t("Yardım")} title={t("Yardım")}><CircleHelp size={17}/></Link>
        <Link href="/ilan-ver" className="small-primary">{t("Yeni ilan ver")}<Plus size={17}/></Link>
      </div>
    </div>

    <div className="ov-kpis">
      <button type="button" className="ov-kpi" onClick={() => open("listings")}><span className="ov-kpi-icon"><LayoutList size={19}/></span><span className="ov-kpi-label">{t("Yayındaki ilan")}</span><strong>{number(counts.published)}</strong><small>{t("{a} incelemede · {b} süresi doldu").replace("{a}", String(counts.pending)).replace("{b}", String(counts.expired))}</small></button>
      <div className="ov-kpi"><span className="ov-kpi-icon"><Eye size={19}/></span><span className="ov-kpi-label">{t("Görüntülenme")}</span><strong>{number(totals.views)}</strong><Change now={totals.views} before={previous.views}/></div>
      <div className="ov-kpi"><span className="ov-kpi-icon"><Phone size={19}/></span><span className="ov-kpi-label">{t("İletişim")}</span><strong>{number(totals.contacts)}</strong><Change now={totals.contacts} before={previous.contacts}/><small>{t("{p} telefon · {w} WhatsApp · {m} mesaj").replace("{p}", String(totals.phone)).replace("{w}", String(totals.whatsapp)).replace("{m}", String(totals.messages))}</small></div>
      <button type="button" className={`ov-kpi ${reminders.unanswered ? "alert" : ""}`} onClick={() => open("messages")}><span className="ov-kpi-icon"><Bell size={19}/></span><span className="ov-kpi-label">{t("Yanıt bekleyen")}</span><strong>{number(reminders.unanswered)}</strong><small>{t(reminders.unanswered ? "24 saati geçen mesaj var" : "Bekleyen müşteri yok")}</small></button>
    </div>

    <div className="ov-grid ov-row-main">
      <section className="ov-card ov-chart-card">
        <header><div><h3>{t("Görüntülenme ve iletişim")}</h3><p>{t("Günlük; her ziyaretçi günde bir kez sayılır.")}</p></div><div className="ov-legend"><span><i className="views"/>{t("Görüntülenme")}</span><span><i className="contacts"/>{t("İletişim")}</span></div></header>
        <Chart series={data.series}/>
      </section>
      <section className="ov-card ov-top">
        {top ? <>
          <div className="ov-top-photo">{top.photo ? <img src={top.photo} alt="" loading="lazy"/> : <div className="ov-top-photo-empty"><BookmarkCheck size={34} aria-hidden="true"/></div>}<span className="ov-badge"><Sparkles size={13} aria-hidden="true"/>{t("En çok ilgi gören ilanınız")}</span></div>
          <div className="ov-top-body">
            <Link href={`/ilan/${top.id}`} className="ov-top-title">{top.title}<ArrowUpRight size={16} aria-hidden="true"/></Link>
            <p>{[top.district, top.city].filter(Boolean).join(", ")} · {t(typeLabel(top.propertyType))}</p>
            <strong className="ov-top-price"><DisplayMoney value={top.price} currency={top.currency}/></strong>
            <div className="ov-top-stats"><div><strong>{number(top.views)}</strong><span>{t("Görüntülenme")}</span></div><div><strong>{number(top.favorites)}</strong><span>{t("Favori")}</span></div><div><strong>{number(top.contacts)}</strong><span>{t("İletişim")}</span></div></div>
            <div className="ov-health"><span>{t("İlan sağlığı")}</span><div className={`ov-health-bar ${scoreClass(top.score)}`}><i style={{ width: `${top.score}%` }}/></div><strong>{top.score}/100</strong></div>
            {top.metrics?.insights?.[0] && <p className="ov-advice"><TrendingUp size={14} aria-hidden="true"/>{t(ADVICE[top.metrics.insights[0].code] || top.metrics.insights[0].code).replace("{n}", top.metrics.insights[0].value === undefined ? "" : number(top.metrics.insights[0].value))}</p>}
          </div>
        </> : <div className="ov-top-empty"><BookmarkCheck size={34} aria-hidden="true"/><h3>{t("İlk ilanınızı verin")}</h3><p>{t("İlanınız 10 dile çevrilir; performansı burada görürsünüz.")}</p><Link href="/ilan-ver" className="small-primary">{t("İlan ver")}<Plus size={16}/></Link></div>}
      </section>
    </div>

    <div className="ov-grid ov-row-three">
      <section className="ov-card"><header><div><h3>{t("Satış hunisi")}</h3><p>{t("Görüntülemeden randevuya")}</p></div></header><Funnel totals={totals}/></section>
      <section className="ov-card ov-todo"><header><div><h3>{t("Bugün yapılacaklar")}</h3><p>{t(openTodos.length ? "Bekleyen {n} iş" : "Her şey yolunda").replace("{n}", String(openTodos.length))}</p></div></header>
        {openTodos.length ? <ul>{openTodos.map((item) => { const Icon = item.icon; return <li key={item.title}><button type="button" onClick={() => open(item.target)}><span className={`ov-todo-icon ${item.tone}`}><Icon size={16} aria-hidden="true"/></span><span><strong>{t(item.title)}</strong><small>{t(item.text)}</small></span><b>{item.count}</b><ChevronRight size={16} aria-hidden="true"/></button></li>; })}</ul>
          : <div className="ov-done"><BookmarkCheck size={28} aria-hidden="true"/><p>{t("Yanıt bekleyen müşteri, onay bekleyen randevu veya süresi dolan ilan yok.")}</p></div>}
      </section>
      <section className="ov-card"><header><div><h3>{t("Yaklaşan randevular")}</h3><p>{t("Yer gösterme ziyaretleri")}</p></div></header><WeekAppointments appointments={data.appointments} open={open}/></section>
    </div>

    <section className="ov-card ov-table-card">
      <header><div><h3>{t("İlanlarım")}</h3><p>{t("{n} ilan · son {d} gün").replace("{n}", String(data.listings.length)).replace("{d}", String(data.days))}</p></div>
        <div className="ov-table-tools">
          <label className="ov-search"><Search size={15} aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("İlan ara")} aria-label={t("İlan ara")}/></label>
          <div className="ov-periods" role="group" aria-label={t("Durum")}>{(["all", "published", "pending", "expired"] as const).map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(value === "all" ? "Tümü" : STATUS[value])}</button>)}</div>
        </div>
      </header>
      {rows.length ? <div className="ov-table-wrap"><table className="ov-table">
        <thead><tr><th>{t("İlan")}</th><th>{t("Fiyat")}</th><th>{t("Görüntülenme")}</th><th>{t("İletişim")}</th><th>{t("Sağlık")}</th><th>{t("Durum")}</th><th><span className="sr-only">{t("Aç")}</span></th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td data-label={t("İlan")}><Link href={`/ilan/${row.id}`} className="ov-listing">{row.photo ? <img src={row.photo} alt="" loading="lazy"/> : <span className="ov-listing-empty"/>}<span><strong>{row.title}</strong><small>{t(typeLabel(row.propertyType))} · {t(row.purpose === "kiralik" ? "Kiralık" : "Satılık")} · {[row.district, row.city].filter(Boolean).join(", ")}</small></span></Link></td>
          <td data-label={t("Fiyat")}><DisplayMoney value={row.price} currency={row.currency}/></td>
          <td data-label={t("Görüntülenme")}>{number(row.views)}</td>
          <td data-label={t("İletişim")}>{number(row.contacts)}</td>
          <td data-label={t("Sağlık")}>{row.status === "published" ? <span className={`ov-score ${scoreClass(row.score)}`}>{row.score}</span> : "—"}</td>
          <td data-label={t("Durum")}>{statusPill(row)}</td>
          <td><Link href={`/ilan/${row.id}`} className="ov-row-open" aria-label={t("İlanı aç")}><ArrowUpRight size={16}/></Link></td>
        </tr>)}</tbody>
      </table></div> : <p className="ov-empty">{t(data.listings.length ? "Bu ölçütlere uygun ilan yok." : "Henüz ilanınız yok.")}</p>}
      <button type="button" className="ov-card-link" onClick={() => open("crm")}>{t("Ayrıntılı istatistikler ve öneriler")}<ChevronRight size={15} aria-hidden="true"/></button>
    </section>

    <div className="ov-grid ov-row-two">
      <section className="ov-card"><header><div><h3>{t("Son müşteriler")}</h3><p>{t("İlanlarınız için yazan kişiler")}</p></div></header>
        {data.customers.length ? <ul className="ov-customers">{data.customers.map((c) => <li key={`${c.listingId}:${c.peerId}`}>
          <span className="ov-avatar" aria-hidden="true">{(c.name || "?").charAt(0).toLocaleUpperCase(locale)}</span>
          <div><strong>{c.name}</strong><span>{c.listingTitle}</span></div>
          <div className="ov-customer-meta">{c.waiting && <span className="ov-pill warn">{t("Yanıt bekliyor")}</span>}<small>{ago(c.lastAt)}</small></div>
          <Link className="ov-icon" href={`/hesabim?tab=mesajlar&listingId=${encodeURIComponent(c.listingId)}&peerId=${c.peerId}`} aria-label={`${t("Mesaj")}: ${c.name}`}><MessageCircle size={16}/></Link>
        </li>)}</ul> : <div className="ov-done"><UserRound size={28} aria-hidden="true"/><p>{t("Henüz size yazan olmadı. İlanlarınız görüntülendikçe mesajlar burada görünür.")}</p></div>}
      </section>
      <section className="ov-card"><header><div><h3>{t("Ziyaretçi dilleri")}</h3><p>{t("İlanlarınızı hangi dilde inceliyorlar")}</p></div></header>
        {languages.length ? <ul className="ov-languages">{languages.map(([code, value]) => <li key={code}>{FLAG[code] ? <img src={`/flags/${FLAG[code]}.svg`} alt="" width={22} height={16}/> : <span className="ov-lang-code">{code.toUpperCase()}</span>}<span>{languageName(code)}</span><div><i style={{ width: `${Math.round(value / languageTotal * 100)}%` }}/></div><strong>%{Math.round(value / languageTotal * 100)}</strong></li>)}</ul>
          : <div className="ov-done"><Eye size={28} aria-hidden="true"/><p>{t("Dil bilgisi, çerez izni veren ziyaretçiler geldikçe oluşur.")}</p></div>}
      </section>
    </div>
    <p className="ov-footnote">{t("Merhaba {name}; rakamlar her ziyaretçiyi günde bir kez sayar, botları ve sizi saymaz.").replace("{name}", name.split(" ")[0])}</p>
  </div>;
}
