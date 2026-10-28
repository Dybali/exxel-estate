"use client";
import {apiJson} from '@/lib/api-client';

import {IndividualPolicyNotice} from "./IndividualPolicyNotice";
import {CompanyAccount} from './CompanyAccount';
import {CompanyTeam} from './CompanyTeam';
import {AppointmentsPanel} from "./Appointments";
import {LeadsPanel} from "./LeadsPanel";
import {EmailPreferences} from "./EmailPreferences";
import {MyReports} from './MyReports';
import {AccountSecurity} from "./AccountSecurity";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { CalendarDays, ArrowUpRight, Bookmark, Heart, LayoutDashboard, LogOut, Mail, Plus, UserRound, Users } from "lucide-react";
import { type Listing, formatPrice } from "@/lib/listings";
import {DiscoveryPanel} from "./DiscoveryPanel";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ManagedListings } from "@/components/ManagedListings";
import { favoritesChanged } from "@/lib/favorites-client";
import {OfficeVerification} from './OfficeVerification';
import { SellerUpgrade } from "@/components/SellerUpgrade";
import { MessagesInbox, type Conversation } from "@/components/MessagesInbox";

type User = { id: string; name: string; email: string; email_verified: number; role: string; agent_status: string; phone?: string | null; whatsapp_enabled?: number; company?: string | null; avatar_url?: string | null; bio?:string; companyCategory?:string|null; isAdmin?: boolean };

export function Dashboard() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(params.get("tab") || "genel");
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [draft,setDraft]=useState<{payload:{fields:Record<string,string>};updatedAt:string}|null>(null);
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
      setFavorites((saved as { listings?: Listing[] }).listings || []);
      setMine((listings as { listings?: Listing[] }).listings || []);
      setConversations((inbox as { conversations?: Conversation[] }).conversations || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(()=>{const refresh=()=>fetch("/api/account",{cache:"no-store"}).then(response=>apiJson<{user?:User}>(response)).then((data:{user?:User})=>setUser(data.user||null)).catch(()=>{});window.addEventListener("salesorrent:profile-changed",refresh);return()=>window.removeEventListener("salesorrent:profile-changed",refresh);},[]);

  useEffect(() => {
    if (!loading && user && !user.email_verified) { window.location.replace("/eposta-dogrula"); return; }
    if (!loading && !user) {
      const query = typeof window !== "undefined" ? window.location.search : "";
      window.location.replace(`/giris?next=${encodeURIComponent(`/hesabim${query}`)}`);
    }
  }, [loading, user]);

  useEffect(()=>{if(tab!=="ilanlarim"&&tab!=="genel")return;const controller=new AbortController();fetch('/api/listing-draft',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?apiJson<{draft?:import('@/lib/listing-drafts').DraftRecord|null}>(r):{draft:null}).then(data=>{if(!controller.signal.aborted)setDraft(data.draft||null);}).catch(()=>{});return()=>controller.abort();},[tab]);
  async function logout() {
    await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }

  async function removeFavorite(id:string) {
    const response=await fetch(`/api/favorites?id=${encodeURIComponent(id)}`,{method:"DELETE"});
    if(response.ok){setFavorites(items=>items.filter(item=>item.id!==id));favoritesChanged();}
  }

  if (loading || !user || !user.email_verified) return <main className="account-page"><div className="container section">{t(loading ? "Hesabınız yükleniyor..." : "Giriş sayfasına yönlendiriliyorsunuz...")}</div></main>;

  const items = [
    { id: "genel", label: "Genel Bakış", icon: LayoutDashboard },
    { id: "favoriler", label: "Favorilerim", icon: Heart },
    { id: "ilanlarim", label: "İlanlarım", icon: Bookmark },
    { id: "mesajlar", label: "Mesajlar", icon: Mail },
    {id:"randevular",label:"Randevularım",icon:CalendarDays},
    ...(["agent","individual","admin"].includes(user.role)?[{id:"talepler",label:"Müşteri talepleri",icon:Users}]:[]),
    {id:"bildirimler",label:"Aramalarım ve bildirimler",icon:Bookmark},
    {id:"bildirimlerim",label:"İlan bildirimlerim",icon:Mail},
    { id: "profil", label: "Profilim", icon: UserRound },
    { id: "ekip", label: "Ekip ve davetler", icon: UserRound },
    ...(user.role==="agent"?[{id:"firma",label:"Firma bilgilerim",icon:LayoutDashboard}]:[]),
  ];

  return <main className="account-page">
    <div className="account-head"><div className="container"><span className="eyebrow dark-eyebrow">{t("ESTATEMARKET24 HESABIM")}</span><h1>{t("Hoş geldiniz,")} <em>{user.name.split(" ")[0]}.</em></h1><p>{t("Yaşam alanlarınızı ve görüşmelerinizi buradan yönetin.")}</p></div></div>
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
        {draft&&(tab==="genel"||tab==="ilanlarim")&&<div className="draft-dashboard-card"><div><strong>{draft.payload.fields.title||t("Tamamlanmamış ilanınız var")}</strong><p>{t("Taslak")} · {new Date(draft.updatedAt).toLocaleString(locale)}</p></div><Link href="/ilan-ver">{t("Taslağa devam et")} →</Link></div>}
        {tab === "genel" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("GENEL BAKIŞ")}</span><h2>{t("Hesabınızın özeti")}</h2></div><Link href="/ilan-ver" className="small-primary">{t("Yeni ilan ver")}<Plus size={17}/></Link></div>
          <div className="summary-cards"><div><Heart size={22}/><strong>{favorites.length}</strong><span>{t("Favori ilan")}</span></div><div><Bookmark size={22}/><strong>{mine.length}</strong><span>{t("İlanım")}</span></div><div><Mail size={22}/><strong>{conversations.length}</strong><span>{t("Görüşme")}</span></div></div>
          <div className="panel-note"><h3>{t("Yeni bir yaşam alanı keşfedin")}</h3><p>{t("Aradığınız özelliklere uygun ilanları gelişmiş filtrelerle bulun.")}</p><Link className="text-link" href="/ilanlar">{t("İlanları incele")}<ArrowUpRight size={16}/></Link></div>
        </>}
        {tab === "favoriler" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("KAYDETTİKLERİNİZ")}</span><h2>{t("Favori ilanlarım")}</h2></div></div>
          {favorites.length ? <div className="favorite-dashboard-grid">{favorites.map(listing=><article className="favorite-dashboard-card" key={listing.id}><Link href={`/ilan/${listing.id}`}><img src={listing.images[0]} alt=""/><div><h3>{locale==="tr"?listing.title:listing.translations?.[locale]?.title||listing.title}</h3><p>{listing.district}, {listing.city} · {listing.grossArea} m²</p><strong>{formatPrice(listing.price,listing.currency,locale)}</strong></div></Link><button type="button" onClick={()=>removeFavorite(listing.id)} aria-label={t("Favorilerden çıkar")}><Heart size={17} fill="currentColor"/>{t("Favorilerden çıkar")}</button></article>)}</div> : <div className="panel-empty"><Heart size={28}/><h3>{t("Henüz favori ilanınız yok.")}</h3><Link href="/ilanlar">{t("İlanlara göz atın")} →</Link></div>}

        </>}
        {tab === "ilanlarim" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLAN YÖNETİMİ")}</span><h2>{t("İlanlarım")}</h2></div><Link href="/ilan-ver" className="small-primary">{t("İlan ver")}<Plus size={17}/></Link></div>
          {user.role==="individual"&&!user.isAdmin&&<IndividualPolicyNotice/>}{user.role==="agent"&&user.agent_status==="approved"&&<p className="profile-save-success">{t("Onaylı emlakçı hesabınızla ilanlarınız doğrudan yayımlanır.")}</p>}
          {mine.length ? <ManagedListings listings={mine} onChange={setMine}/> : <div className="panel-empty"><Bookmark size={28}/><h3>{t("Henüz ilan eklemediniz.")}</h3><Link href="/ilan-ver">{t("İlk ilanınızı oluşturun")} →</Link></div>}

        </>}
        {tab === "mesajlar" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLETİŞİM")}</span><h2>{t("Mesajlarım")}</h2></div></div><MessagesInbox userId={user.id} initialConversations={conversations}/></>}
        {tab === "bildirimlerim" && <MyReports/>}{tab === "bildirimler" && <><EmailPreferences/><DiscoveryPanel/></>}{tab==="randevular"&&<AppointmentsPanel userId={user.id}/>}{tab==="talepler"&&<LeadsPanel/>}
        {tab === "ekip" && <CompanyTeam/>}
        {tab === "firma" && user.role==='agent' && <CompanyAccount/>}
        {tab === "profil" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("HESAP BİLGİLERİ")}</span><h2>{t("Profilim")}</h2></div></div><div className="profile-facts"><div><span>{t("Ad Soyad")}</span><strong>{user.name}</strong></div><div><span>{t("E-posta")}</span><strong>{user.email}</strong></div><div><span>{t("Hesap türü")}</span><strong>{t(user.role === "agent" ? user.companyCategory==="developer"?"İnşaat firması":"Emlakçı" : user.role === "individual" ? "Bireysel İlan Veren" : "Kullanıcı")}</strong></div>{user.role === "agent" && <div><span>{t("Onay durumu")}</span><strong>{t(user.agent_status === "approved" ? "Onaylandı" : "İnceleniyor")}</strong></div>}</div><ProfileEditor user={user} onSaved={saved=>setUser(old=>old?{...old,...saved}:old)}/><SellerUpgrade user={user}/>{user.role==='agent'&&<OfficeVerification/>}<AccountSecurity/></>}
      </section>
    </div>
  </main>;
}
