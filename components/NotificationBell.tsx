"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Clock, FileText, Inbox, MessageCircle, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { apiJson } from "@/lib/api-client";
import type { OverviewTarget } from "./AgentOverview";

// Bell in the Hesabım top bar of estate agents and the admin account (components/Dashboard.tsx). It opens a short
// list of what needs attention (unread messages and the reminders of GET /api/crm/overview, the same ones the
// Genel Bakış panel shows); each row opens the matching tab. It used to jump straight to Mesajlar.
type Reminders = { unanswered: number; pendingAppointments: number; newRequests: number; expiringSoon: number; drafts: number };
export function NotificationBell({ unreadMessages, open }: { unreadMessages: number; open: (target: OverviewTarget) => void }) {
  const { t, locale } = useLocale();
  const [reminders, setReminders] = useState<Reminders | null>(null), [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = () => fetch("/api/crm/overview?days=30", { cache: "no-store" }).then((r) => r.ok ? apiJson<{ reminders?: Reminders }>(r) : null).then((data) => { if (data?.reminders) setReminders(data.reminders); }).catch(() => {});
  // The site header's bell links estate agents to /hesabim?bildirim=1 (they have no saved-search tab): open the list.
  useEffect(() => { const url = new URL(window.location.href); if (url.searchParams.get("bildirim") !== "1") return; setShown(true); box.current?.scrollIntoView({ block: "center" }); url.searchParams.delete("bildirim"); history.replaceState(null, "", url.pathname + url.search); }, []);
  useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 120000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!shown) return;
    const outside = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setShown(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setShown(false); };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [shown]);
  const r = reminders;
  const rows = [
    { count: unreadMessages, Icon: MessageCircle, title: "Okunmamış mesajlar", text: "Müşterilerinizden gelen, henüz okumadığınız mesajlar", target: "messages" as const },
    { count: r?.unanswered || 0, Icon: Clock, title: "Yanıt bekleyen müşteriler", text: "24 saatten uzun süredir cevap bekleyen mesajlar", target: "messages" as const, badge: false },
    { count: r?.pendingAppointments || 0, Icon: CalendarDays, title: "Onay bekleyen randevular", text: "Alıcıların istediği yer gösterme saatleri", target: "appointments" as const },
    { count: r?.newRequests || 0, Icon: Inbox, title: "Talep akışında yeni talepler", text: "Ev arayan alıcılar; teklif gönderin", target: "requests" as const },
    { count: r?.expiringSoon || 0, Icon: Clock, title: "Süresi dolmak üzere ilanlar", text: "7 gün içinde yayından kalkacak", target: "listings" as const },
    { count: r?.drafts || 0, Icon: FileText, title: "Tamamlanmamış taslaklar", text: "Yayına almak için tamamlayın", target: "listings" as const, badge: false },
  ].filter((row) => row.count > 0);
  // Drafts and late replies are standing to-dos rather than news: listed, but they do not light the badge.
  const total = rows.filter((row) => row.badge !== false).reduce((sum, row) => sum + row.count, 0);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <div className="pro-bell" ref={box}>
    <button type="button" className="pro-round" aria-expanded={shown} aria-haspopup="true" aria-label={`${t("Bildirimler")}${total ? ` (${total})` : ""}`} title={t("Bildirimler")} onClick={() => { setShown((now) => !now); if (!shown) void load(); }}>
      <Bell size={18}/>{total > 0 && <b>{total > 99 ? "99+" : total}</b>}
    </button>
    {shown && <div className="pro-bell-menu" role="dialog" aria-label={t("Bildirimler")}>
      <div className="pro-bell-head"><strong>{t("Bildirimler")}</strong><button type="button" onClick={() => setShown(false)} aria-label={t("Kapat")}><X size={16}/></button></div>
      {rows.length ? <ul>{rows.map(({ count, Icon, title, text, target, badge }) => <li key={title} className={badge === false ? "quiet" : undefined}><button type="button" onClick={() => { setShown(false); open(target); }}>
        <span className="pro-bell-icon"><Icon size={17} aria-hidden="true"/></span><span className="pro-bell-text"><strong>{t(title)}</strong><small>{t(text)}</small></span><em>{number(count)}</em>
      </button></li>)}</ul> : <p className="pro-bell-empty">{t("Yeni bildirim yok.")}</p>}
    </div>}
  </div>;
}
