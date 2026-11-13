"use client";
import { useState } from "react";
import { BarChart3, CalendarDays, Users } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { CrmStats } from "./CrmStats";
import { LeadsPanel } from "./LeadsPanel";
import { AppointmentsPanel } from "./Appointments";

// Hesabım › CRM: statistics, customer requests and appointments in one place (owner's request 2026-11-13).
// ?bolum=talepler|randevular opens a section directly (older links to those tabs land here).
type Section = "istatistik" | "talepler" | "randevular";
export function CrmPanel({ userId, title, appointments = true }: { userId: string; title: string; appointments?: boolean }) {
  const { t } = useLocale();
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "istatistik";
    const query = new URLSearchParams(window.location.search), tab = query.get("tab");
    const wanted = query.get("bolum") || (tab === "talepler" || tab === "randevular" ? tab : null);
    return wanted === "talepler" || (wanted === "randevular" && appointments) ? wanted : "istatistik";
  });
  const sections: { id: Section; label: string; icon: typeof Users }[] = [
    { id: "istatistik", label: "İstatistikler", icon: BarChart3 },
    { id: "talepler", label: "Müşteri talepleri", icon: Users },
    ...(appointments ? [{ id: "randevular" as Section, label: "Randevular", icon: CalendarDays }] : []),
  ];
  return <section className="crm-panel">
    <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">CRM</span><h2>{t(title)}</h2></div></div>
    <nav className="svc-panel-tabs" aria-label={t(title)}>{sections.map((item) => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)}><item.icon size={16} aria-hidden="true"/>{t(item.label)}</button>)}</nav>
    {section === "istatistik" && <CrmStats/>}
    {section === "talepler" && <LeadsPanel/>}
    {section === "randevular" && <AppointmentsPanel userId={userId}/>}
  </section>;
}
