"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { LANDING_CITIES } from "@/lib/landing-cities";
import type { PreRegistration } from "@/lib/pre-registrations";

// Yönetim › Ön kayıtlar: pre-registrations from the city landing pages, filter by type and city, CSV for Excel.
// Administrators only (Turkish, like the rest of the campaign).
const LABELS = { heading: "Ön kayıtlar", all: "Tümü", agent: "Emlakçı", owner: "Bireysel", allCities: "Tüm şehirler", csv: "Excel (CSV) indir", empty: "Henüz ön kayıt yok.", failed: "Ön kayıtlar yüklenemedi.", yes: "Evet", total: "Toplam" };
export function AdminPreRegistrations() {
  const [role, setRole] = useState(""), [city, setCity] = useState("");
  const [data, setData] = useState<{ entries: PreRegistration[]; counts: { agent: number; owner: number } } | null>(null), [error, setError] = useState("");
  const query = new URLSearchParams({ ...(role ? { role } : {}), ...(city ? { city } : {}) }).toString();
  useEffect(() => { let live = true; setError("");
    fetch(`/api/admin/pre-registrations?${query}`, { cache: "no-store" }).then(async (r) => { if (!r.ok) throw Error(); const d = await r.json() as { entries: PreRegistration[]; counts: { agent: number; owner: number } }; if (live) setData(d); }).catch(() => { if (live) setError(LABELS.failed); });
    return () => { live = false; }; }, [query]);
  const name = (slug: string) => LANDING_CITIES.find((c) => c.slug === slug)?.name || slug;
  return <main className="admin-page">
    <div className="admin-page-heading"><div><h1>{LABELS.heading}</h1>{data && <p>{`${LABELS.total}: ${data.counts.agent + data.counts.owner} · ${LABELS.agent}: ${data.counts.agent} · ${LABELS.owner}: ${data.counts.owner}`}</p>}</div>
      <a className="admin-primary" href={`/api/admin/pre-registrations?format=csv${query ? "&" + query : ""}`}><Download size={16}/> {LABELS.csv}</a></div>
    <div className="admin-filters" style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
      <select value={role} onChange={(e) => setRole(e.target.value)}><option value="">{LABELS.all}</option><option value="agent">{LABELS.agent}</option><option value="owner">{LABELS.owner}</option></select>
      <select value={city} onChange={(e) => setCity(e.target.value)}><option value="">{LABELS.allCities}</option>{LANDING_CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
    </div>
    {error && <div className="admin-notice error" role="alert">{error}</div>}
    {data && !data.entries.length && <p>{LABELS.empty}</p>}
    {data && data.entries.length > 0 && <div style={{ overflowX: "auto" }}><table className="admin-table"><thead><tr>
      {["Tarih", "Tür", "Şehir", "Ad soyad", "Ofis", "Telefon", "E-posta", "İlçe", "Ayrıntı", "İzin", "%50", "Kaynak"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
      {data.entries.map((e) => <tr key={e.id}><td>{new Date(e.createdAt).toLocaleString("tr-TR")}</td><td>{e.role === "agent" ? LABELS.agent : LABELS.owner}</td><td>{name(e.city)}</td><td>{e.name}</td><td>{e.company || ""}</td>
        <td><a href={`tel:${e.phone}`}>{e.phone}</a></td><td><a href={`mailto:${e.email}`}>{e.email}</a></td><td>{e.district || ""}</td>
        <td>{[e.portfolio, e.foreignSales, e.package, e.propertyType, e.propertyCount, e.purpose, e.timeline].filter(Boolean).join(" · ")}</td>
        <td>{e.marketing ? LABELS.yes : ""}</td><td>{e.gift ? LABELS.yes : ""}</td><td>{[e.utmSource, e.utmCampaign].filter(Boolean).join(" / ") || e.host || ""}</td></tr>)}
    </tbody></table></div>}
  </main>;
}
