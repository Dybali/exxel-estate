"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowDownToLine, Check, ShieldCheck, X } from "lucide-react";
import { AdminMessages } from "./AdminMessages";
import type { MessageRecipient } from "./MessagesInbox";
import {AdminReports} from './AdminReports';
import {AdminOfficeVerifications} from './AdminOfficeVerifications';
import {AdminAudit} from "./AdminAudit";
import { CountrySettings } from "./CountrySettings";
import {AdminTranslations} from './AdminTranslations';

type UserRow = { id: string; name: string; email: string; role: string; agent_status: string; company?: string };
type ListingRow = { id: string; title: string; city: string; district: string; owner_name: string; owner_id: string; price: number; status: string; created_at: string };
type MessageRow = { id: string; body: string; listing_id: string; created_at: string };
type AdminData = { users: UserRow[]; listings: ListingRow[]; listingTotal: number; pendingTotal: number; page: number; pageSize: number; messages: MessageRow[]; countries: any[] };

export function AdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [recipient, setRecipient] = useState<MessageRecipient | null>(null);
  const [unread, setUnread] = useState(0);
  function contact(person: MessageRecipient) { setRecipient({ ...person }); document.getElementById("admin-message-center")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin?page=${page}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Bu alan yalnızca yetkili yöneticilere açıktır.");
      setData(await response.json() as AdminData);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Yönetim paneli yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { reload(); }, [reload]);

  async function updateAgent(id: string, status: string) {
    setError("");
    const response = await fetch("/api/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "agent", id, status }),
    });
    if (response.ok) await reload();
    else {
      const result = await response.json() as { error?: string };
      setError(result.error || "İşlem tamamlanamadı.");
    }
  }

  if (loading) return <main className="admin-page"><div className="container section">Yönetim paneli yükleniyor...</div></main>;
  if (!data) return <main className="admin-page"><div className="container form-gate"><ShieldCheck size={37}/><h1>Yönetici erişimi gerekli.</h1><p>{error} Doğrulanmış yönetici hesabıyla giriş yapın.</p><Link href="/hesabim" className="primary-button">Hesabıma Dön</Link></div></main>;

  const agents = data.users.filter((user) => user.role === "agent");
  const pageCount = Math.max(1, Math.ceil(data.listingTotal / data.pageSize));

  return <main className="admin-page">
    <div className="form-hero"><div className="container"><span className="eyebrow dark-eyebrow">ESTATEMARKET24 · YÖNETİM</span><h1>Platform <em>yönetimi.</em></h1><p>İlanları, emlakçıları ve gelen mesajları tek yerden kontrol edin.</p></div></div>
    <div className="container admin-body">
      <a className="report-admin-shortcut" href="#admin-reports">İlan bildirimlerini incele ↓</a><div className="admin-stats"><div><strong>{data.listingTotal}</strong><span>Gerçek ilan</span></div><div><strong>{data.pendingTotal}</strong><span>Onay bekleyen ilan</span></div><div><strong>{data.users.filter((user) => user.agent_status === "pending").length}</strong><span>Onay bekleyen emlakçı</span></div><div><a href="#admin-message-center"><strong>{unread}</strong><span>Okunmamış mesaj →</span></a></div></div>
      <div className="admin-section-head"><div><span className="eyebrow dark-eyebrow">İLANLAR</span><h2>Yayın yönetimi</h2></div><a href="/api/export" className="outline-button" download><ArrowDownToLine size={17}/> Verileri indir</a></div>
      <div className="admin-table-wrap"><table><thead><tr><th>İlan</th><th>Konum</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{data.listings.length ? data.listings.map((listing) => <tr key={listing.id}><td>{listing.title}<small>{listing.owner_name}</small></td><td>{listing.district}, {listing.city}</td><td>{listing.status === "published" ? "Yayında" : listing.status === "pending" ? "Bekliyor" : "Reddedildi"}</td><td><Link href={`/yonetim/ilan/${listing.id}`} className="admin-review-link">İncele →</Link><button className="admin-contact-link" onClick={() => contact({ id: listing.owner_id, name: listing.owner_name, context: listing.title })}>Mesaj yaz</button></td></tr>) : <tr><td colSpan={4}>Henüz gerçek ilan yok. Örnek ilanlar katalogda görünüyor.</td></tr>}</tbody></table></div>
      {pageCount > 1 && <div className="admin-pagination"><button type="button" onClick={() => setPage((old) => Math.max(1, old - 1))} disabled={page <= 1}>Önceki</button><span>Sayfa {page} / {pageCount}</span><button type="button" onClick={() => setPage((old) => Math.min(pageCount, old + 1))} disabled={page >= pageCount}>Sonraki</button></div>}
      <div className="admin-section-head"><div><span className="eyebrow dark-eyebrow">EMLAKÇILAR</span><h2>Hesap onayları</h2></div></div>
      <div className="admin-table-wrap"><table><thead><tr><th>Ad / ofis</th><th>E-posta</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{agents.length ? agents.map((agent) => <tr key={agent.id}><td>{agent.name}{agent.company && <small>{agent.company}</small>}</td><td>{agent.email}</td><td>{agent.agent_status}</td><td><a className="admin-review-link" href="#admin-office-verifications">Yetki belgesini incele →</a><button type="button" onClick={() => updateAgent(agent.id, "rejected")}><X size={15}/> Reddet</button><button className="admin-contact-link" onClick={() => contact(agent)}>Mesaj yaz</button></td></tr>) : <tr><td colSpan={4}>Henüz emlakçı başvurusu yok.</td></tr>}</tbody></table></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <AdminOfficeVerifications onReviewed={reload}/>
      <AdminReports/>
      <AdminTranslations/>
      <AdminMessages recipient={recipient} onUnreadChange={setUnread}/>
      <CountrySettings countries={data.countries || []} onSaved={reload}/><AdminAudit/>
    </div>
  </main>;
}


