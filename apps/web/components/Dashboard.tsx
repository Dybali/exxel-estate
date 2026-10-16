"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { ArrowUpRight, Bookmark, Heart, LayoutDashboard, LogOut, Mail, Plus, UserRound } from "lucide-react";
import { DEMO_LISTINGS, type Listing, formatPrice } from "@/lib/listings";
import { SellerUpgrade } from "@/components/SellerUpgrade";
import { MessagesInbox, type Conversation } from "@/components/MessagesInbox";

type User = { id: string; name: string; email: string; email_verified: number; role: string; agent_status: string; company?: string | null; avatar_url?: string | null; isAdmin?: boolean };

export function Dashboard() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(params.get("tab") || "genel");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/account").then((response) => response.json()),
      fetch("/api/favorites").then((response) => response.ok ? response.json() : { ids: [] }),
      fetch("/api/mine").then((response) => response.ok ? response.json() : { listings: [] }),
      fetch("/api/messages").then((response) => response.ok ? response.json() : { conversations: [] }),
    ]).then(([account, saved, listings, inbox]) => {
      setUser((account as { user?: User }).user || null);
      setFavorites((saved as { ids?: string[] }).ids || []);
      setMine((listings as { listings?: Listing[] }).listings || []);
      setConversations((inbox as { conversations?: Conversation[] }).conversations || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      const query = typeof window !== "undefined" ? window.location.search : "";
      window.location.replace(`/giris?next=${encodeURIComponent(`/hesabim${query}`)}`);
    }
  }, [loading, user]);

  async function logout() {
    await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }

  async function removeListing(id: string) {
    if (!confirm("İlanı silmek istediğinize emin misiniz?")) return;
    const response = await fetch(`/api/listings/${id}`, { method: "DELETE" });
    if (response.ok) setMine((items) => items.filter((listing) => listing.id !== id));
  }

  if (loading || !user) return <main className="account-page"><div className="container section">{t(loading ? "Hesabınız yükleniyor..." : "Giriş sayfasına yönlendiriliyorsunuz...")}</div></main>;

  const items = [
    { id: "genel", label: "Genel Bakış", icon: LayoutDashboard },
    { id: "favoriler", label: "Favorilerim", icon: Heart },
    { id: "ilanlarim", label: "İlanlarım", icon: Bookmark },
    { id: "mesajlar", label: "Mesajlar", icon: Mail },
    { id: "profil", label: "Profilim", icon: UserRound },
  ];

  return <main className="account-page">
    <div className="account-head"><div className="container"><span className="eyebrow dark-eyebrow">{t("SALESORRENT HESABIM")}</span><h1>{t("Hoş geldiniz,")} <em>{user.name.split(" ")[0]}.</em></h1><p>{t("Yaşam alanlarınızı ve görüşmelerinizi buradan yönetin.")}</p></div></div>
    <div className="container account-layout">
      <aside className="account-sidebar">
        <div className="account-user">{user.avatar_url ? <img src={user.avatar_url} alt="" width={42} height={42} className="account-avatar-img"/> : <div>{user.name.charAt(0).toUpperCase()}</div>}<span><strong>{user.name}</strong><small>{user.email}</small></span></div>
        <div className="account-nav">
          {items.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); history.replaceState(null, "", `/hesabim?tab=${item.id}`); }}><item.icon size={17}/>{t(item.label)}</button>)}
          {user.isAdmin && <Link href="/yonetim"><LayoutDashboard size={17}/>{t("Yönetim Paneli")}</Link>}
          <button onClick={logout}><LogOut size={17}/>{t("Çıkış Yap")}</button>
        </div>
      </aside>
      <section className={`account-content ${tab === "mesajlar" ? "account-content-inbox" : ""}`}>
        {tab === "genel" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("GENEL BAKIŞ")}</span><h2>{t("Hesabınızın özeti")}</h2></div><Link href="/ilan-ver" className="small-primary">{t("Yeni ilan ver")}<Plus size={17}/></Link></div>
          <div className="summary-cards"><div><Heart size={22}/><strong>{favorites.length}</strong><span>{t("Favori ilan")}</span></div><div><Bookmark size={22}/><strong>{mine.length}</strong><span>{t("İlanım")}</span></div><div><Mail size={22}/><strong>{conversations.length}</strong><span>{t("Görüşme")}</span></div></div>
          <div className="panel-note"><h3>{t("Yeni bir yaşam alanı keşfedin")}</h3><p>{t("Aradığınız özelliklere uygun ilanları gelişmiş filtrelerle bulun.")}</p><Link className="text-link" href="/ilanlar">{t("İlanları incele")}<ArrowUpRight size={16}/></Link></div>
        </>}
        {tab === "favoriler" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("KAYDETTİKLERİNİZ")}</span><h2>{t("Favori ilanlarım")}</h2></div></div>
          {favorites.length ? <div className="dashboard-list">{favorites.map((id) => { const listing = DEMO_LISTINGS.find((item) => item.id === id); return listing ? <Link href={`/ilan/${listing.id}`} key={id} className="dashboard-list-item"><img src={listing.images[0]} alt=""/><div><strong>{listing.title}</strong><span>{listing.district}, {listing.city}</span></div><b>{formatPrice(listing.price, listing.currency, locale)}</b><ArrowUpRight size={18}/></Link> : <Link href={`/ilan/${id}`} key={id} className="dashboard-list-item"><div><strong>{t("İlanı görüntüle")}</strong></div><ArrowUpRight size={18}/></Link>; })}</div> : <div className="panel-empty"><Heart size={28}/><h3>{t("Henüz favori ilanınız yok.")}</h3><Link href="/ilanlar">{t("İlanlara göz atın")} →</Link></div>}
        </>}
        {tab === "ilanlarim" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLAN YÖNETİMİ")}</span><h2>{t("İlanlarım")}</h2></div><Link href="/ilan-ver" className="small-primary">{t("İlan ver")}<Plus size={17}/></Link></div>
          {mine.length ? <div className="dashboard-list">{mine.map((listing) => <div key={listing.id} className="dashboard-list-item"><img src={listing.images[0]} alt=""/><div><strong>{listing.title}</strong><span>{listing.district}, {listing.city} · {listing.status === "pending" ? t("Onay bekliyor") : listing.status === "published" ? t("Yayında") : t("Reddedildi")}</span>{listing.status === "rejected" && listing.reviewNote && <small className="listing-review-note">{t("Ret nedeni")}: {listing.reviewNote}</small>}</div><b>{formatPrice(listing.price, listing.currency, locale)}</b><button onClick={() => removeListing(listing.id)}>{t("Sil")}</button></div>)}</div> : <div className="panel-empty"><Bookmark size={28}/><h3>{t("Henüz ilan eklemediniz.")}</h3><Link href="/ilan-ver">{t("İlk ilanınızı oluşturun")} →</Link></div>}
        </>}
        {tab === "mesajlar" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLETİŞİM")}</span><h2>{t("Mesajlarım")}</h2></div></div><MessagesInbox userId={user.id} initialConversations={conversations}/></>}
        {tab === "profil" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("HESAP BİLGİLERİ")}</span><h2>{t("Profilim")}</h2></div></div><div className="profile-facts"><div><span>{t("Ad Soyad")}</span><strong>{user.name}</strong></div><div><span>{t("E-posta")}</span><strong>{user.email}</strong></div><div><span>{t("Hesap türü")}</span><strong>{t(user.role === "agent" ? "Emlakçı" : user.role === "individual" ? "Bireysel İlan Veren" : "Kullanıcı")}</strong></div>{user.role === "agent" && <div><span>{t("Onay durumu")}</span><strong>{t(user.agent_status === "approved" ? "Onaylandı" : "İnceleniyor")}</strong></div>}</div><SellerUpgrade user={user}/></>}
      </section>
    </div>
  </main>;
}
