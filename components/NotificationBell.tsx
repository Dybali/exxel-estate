"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/SafeLink";
import { Bell, CalendarDays, ChevronRight, Clock, FileText, Inbox, MessageCircle, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useLiveEvents } from "@/lib/live-client";
import type { DiscoveryAlert, DiscoveryFeed } from "@/lib/discovery-client";

// Bell in the Hesabım top bar of estate agents and the admin account (components/Dashboard.tsx, owner's request
// 2026-11-23): a list of what needs attention instead of jumping to Mesajlar (which has its own envelope button).
// - news (lights the badge): each unread conversation (opens that conversation), each appointment request to
//   confirm, new Talep akışı requests, saved-search and price alerts
// - standing to-dos (listed, no badge): late replies, listings ending within 7 days, drafts (GET /api/crm/overview)
// The site header's bell links agents to /hesabim?bildirim=1, which opens this list. Updates on live messaging events.
type Conversation = { listing_id: string; peer_id: string; peer_name: string; listing_title: string; last_body: string; last_at: string; unread_count?: number };
type Appointment = { id: string; seller_id: string; status: string; slot_at: string; buyer_name: string; listing_title: string };
type Reminders = { unanswered: number; expiringSoon: number; drafts: number };
type State = { conversations: Conversation[]; appointments: Appointment[]; requests: number; alerts: DiscoveryAlert[]; reminders: Reminders };
const EMPTY: State = { conversations: [], appointments: [], requests: 0, alerts: [], reminders: { unanswered: 0, expiringSoon: 0, drafts: 0 } };
const json = async <T,>(url: string): Promise<T | null> => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() as T : null; } catch { return null; } };

export function NotificationBell({ userId, leads, openTab }: { userId: string; leads: boolean; openTab: (id: string, query?: string) => void }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false), [data, setData] = useState<State>(EMPTY), [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const [messages, appointments, board, discovery, overview] = await Promise.all([
      json<{ conversations?: Conversation[] }>("/api/messages"),
      json<{ appointments?: Appointment[] }>("/api/appointments"),
      leads ? json<{ unseen?: number }>("/api/lead-board?count=1") : Promise.resolve(null),
      json<DiscoveryFeed>("/api/discovery"),
      json<{ reminders?: Reminders }>("/api/crm/overview?days=7"),
    ]);
    const now = new Date().toISOString();
    setData({
      conversations: (messages?.conversations || []).filter((c) => Number(c.unread_count) > 0).slice(0, 6),
      appointments: (appointments?.appointments || []).filter((a) => a.seller_id === userId && a.status === "requested" && a.slot_at >= now).slice(0, 4),
      requests: Number(board?.unseen) || 0,
      alerts: (discovery?.alerts || []).slice(0, 5),
      reminders: { unanswered: Number(overview?.reminders?.unanswered) || 0, expiringSoon: Number(overview?.reminders?.expiringSoon) || 0, drafts: Number(overview?.reminders?.drafts) || 0 },
    });
    setLoaded(true);
  }, [leads, userId]);
  // The site header's bell links estate agents here with ?bildirim=1: open the list right away.
  useEffect(() => { const url = new URL(window.location.href); if (url.searchParams.get("bildirim") !== "1") return; setOpen(true); url.searchParams.delete("bildirim"); history.replaceState(null, "", url.pathname + url.search); }, []);
  useEffect(() => { load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 120000); window.addEventListener("messages:changed", load); return () => { clearInterval(timer); window.removeEventListener("messages:changed", load); }; }, [load]);
  useLiveEvents(true, (event) => { if (event.type !== "typing") load(); });
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);
  const unreadMessages = data.conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
  // Standing to-dos are listed but do not light the badge: they are not news.
  const total = unreadMessages + data.appointments.length + data.requests + data.alerts.length;
  const todos = [
    { count: data.reminders.unanswered, Icon: Clock, title: "Yanıt bekleyen müşteriler", text: "24 saatten uzun süredir cevap bekleyen mesajlar", tab: "mesajlar" },
    { count: data.reminders.expiringSoon, Icon: Clock, title: "Süresi dolmak üzere ilanlar", text: "7 gün içinde yayından kalkacak", tab: "ilanlarim" },
    { count: data.reminders.drafts, Icon: FileText, title: "Tamamlanmamış taslaklar", text: "Yayına almak için tamamlayın", tab: "ilanlarim" },
  ].filter((row) => row.count > 0);
  const ago = (iso: string) => { const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000), rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }); return minutes < 60 ? rtf.format(-Math.max(1, minutes), "minute") : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), "hour") : rtf.format(-Math.round(minutes / 1440), "day"); };
  const go = (id: string, query?: string) => { setOpen(false); openTab(id, query); };
  const nothing = total === 0 && todos.length === 0;
  return <div className="pro-bell" ref={box}>
    <button type="button" className="pro-round" onClick={() => { setOpen(!open); if (!open) load(); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`${t("Bildirimler")}${total ? ` (${total})` : ""}`} title={t("Bildirimler")}><Bell size={18}/>{total > 0 && <b>{total > 99 ? "99+" : total}</b>}</button>
    {open && <div className="pro-bell-panel" role="dialog" aria-label={t("Bildirimler")}>
      <header><strong>{t("Bildirimler")}</strong>{total > 0 && <span>{t("{n} yeni").replace("{n}", String(total))}</span>}<button type="button" className="pro-bell-close" onClick={() => setOpen(false)} aria-label={t("Kapat")}><X size={16}/></button></header>
      {!loaded ? <p className="pro-bell-empty">{t("Yükleniyor…")}</p> : nothing ? <div className="pro-bell-empty"><Bell size={26} aria-hidden="true"/><p>{t("Yeni bildirim yok.")}</p><small>{t("Yeni mesajlar, randevu talepleri ve kayıtlı aramalarınıza uyan ilanlar burada görünür.")}</small></div> : <div className="pro-bell-list">
        {data.conversations.map((c) => <button type="button" key={`${c.listing_id}:${c.peer_id}`} onClick={() => go("mesajlar", `listingId=${encodeURIComponent(c.listing_id)}&peerId=${c.peer_id}`)}>
          <span className="pro-bell-icon message"><MessageCircle size={16} aria-hidden="true"/></span>
          <span><strong>{t("{name} size yazdı").replace("{name}", c.peer_name)}</strong><small>{c.last_body}</small><em>{c.listing_id.startsWith("admin:") ? t("Yönetim · Destek") : c.listing_title} · {ago(c.last_at)}</em></span>
          {Number(c.unread_count) > 1 && <b>{c.unread_count}</b>}</button>)}
        {data.appointments.map((a) => <button type="button" key={a.id} onClick={() => go("randevular")}>
          <span className="pro-bell-icon appointment"><CalendarDays size={16} aria-hidden="true"/></span>
          <span><strong>{t("{name} yer görmek istiyor").replace("{name}", a.buyer_name)}</strong><small>{new Date(a.slot_at).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small><em>{a.listing_title}</em></span></button>)}
        {data.requests > 0 && <button type="button" onClick={() => go("talep-akisi")}>
          <span className="pro-bell-icon request"><Inbox size={16} aria-hidden="true"/></span>
          <span><strong>{t("Talep akışında {n} yeni talep").replace("{n}", String(data.requests))}</strong><small>{t("Ev arayan alıcılar; teklif gönderin")}</small></span><ChevronRight size={16} aria-hidden="true"/></button>}
        {data.alerts.map((alert) => <Link key={alert.id} href={alert.href} onClick={() => setOpen(false)}>
          <span className={`pro-bell-icon ${alert.kind === "price" ? (alert.direction === "up" ? "up" : "down") : "search"}`}>{alert.kind === "price" ? (alert.direction === "up" ? <TrendingUp size={16} aria-hidden="true"/> : <TrendingDown size={16} aria-hidden="true"/>) : <Search size={16} aria-hidden="true"/>}</span>
          <span><strong>{alert.kind === "price" ? t(alert.direction === "up" ? "Favori ilanınızın fiyatı arttı" : "Favori ilanınızın fiyatı düştü") : t("Kayıtlı aramanıza {n} yeni ilan").replace("{n}", String(alert.count || 0))}</strong><small>{alert.name}</small><em>{ago(alert.createdAt)}</em></span></Link>)}
        {todos.length > 0 && <p className="pro-bell-section">{t("Yapılacaklar")}</p>}
        {todos.map(({ count, Icon, title, text, tab }) => <button type="button" key={title} className="quiet" onClick={() => go(tab)}>
          <span className="pro-bell-icon todo"><Icon size={16} aria-hidden="true"/></span>
          <span><strong>{t(title)}</strong><small>{t(text)}</small></span><b>{count}</b></button>)}
      </div>}
      <footer><button type="button" onClick={() => go("mesajlar")}>{t("Tüm mesajlar")}</button><button type="button" onClick={() => go("aramalar")}>{t("Bildirim ayarları")}</button></footer>
    </div>}
  </div>;
}
