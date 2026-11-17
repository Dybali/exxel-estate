"use client";
import { ForwardArrow } from "@/components/DirectionalArrow";
import {draftHasContent} from "@/lib/listing-drafts";
import {apiJson} from '@/lib/api-client';

import {IndividualPolicyNotice} from "./IndividualPolicyNotice";
import {CompanyAccount} from './CompanyAccount';
import {CompanyTeam} from './CompanyTeam';
import {AppointmentsPanel} from "./Appointments";
import {EmailPreferences} from "./EmailPreferences";
import {MyOrders} from "./Orders";
import {AgentHomeRequests,MyHomeRequests} from "./HomeRequestsPanels";
import {AgentLanguagesSetting} from "./AgentLanguagesSetting";
import {MyReports} from './MyReports';
import {AccountSecurity} from "./AccountSecurity";
import {ProjectsPanel} from "./ProjectsPanel";
import {ServiceQuotesPanel} from "./ServiceQuotesPanel";
import {LandRequestsPanel} from "./ContractorPanel";
import {FeedbackCard} from "./FeedbackWidget";
import {AccountKindSwitch} from "./AccountKindSwitch";
import {CrmPanel} from "./CrmPanel";
import {BarChart3} from "lucide-react";
import {ACCOUNT_KIND_LABELS,panelTab,panelTabs,type PanelTabId} from "@/lib/account-panel";
import type {AccountKind} from "@/lib/account-kind";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { Building2, CalendarDays, ArrowUpRight, Bookmark, Heart, LayoutDashboard, LogOut, Mail, Plus, UserRound, Users, Wrench,ClipboardList,HardHat,Search,Store,ShoppingBag} from "lucide-react";
import { type Listing } from "@/lib/listings";
import { DisplayMoney } from "./DisplayCurrency";
import {DiscoveryPanel} from "./DiscoveryPanel";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ManagedListings } from "@/components/ManagedListings";
import { favoritesChanged } from "@/lib/favorites-client";
import {OfficeVerification} from './OfficeVerification';
import { SellerUpgrade } from "@/components/SellerUpgrade";
import { MessagesInbox, type Conversation } from "@/components/MessagesInbox";
import {photoVariantUrl} from "@/lib/listing-media";

type User = { id: string; name: string; email: string; email_verified: number; role: string; agent_status: string; phone?: string | null; whatsapp_enabled?: number; company?: string | null; avatar_url?: string | null; bio?:string; companyCategory?:string|null; isAdmin?: boolean; accountKind?: AccountKind };
const ICONS:Record<PanelTabId,typeof Heart>={genel:LayoutDashboard,favoriler:Heart,aramalar:Search,ilanlarim:Bookmark,projelerim:Building2,mesajlar:Mail,randevular:CalendarDays,crm:BarChart3,talepler:Users,siparisler:ShoppingBag,teklifler:ClipboardList,firma:Store,ekip:Users,muteahhit:HardHat,hizmet:Wrench,profil:UserRound};

export function Dashboard() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // No tab: each account type opens on its own start page (lib/account-panel.ts panelTab). A member who signed up
  // with a company invite code lands on Profilim, where the code is accepted.
  const [tab, setTab] = useState<string|null>(()=>{const requested=params.get("tab");try{if(requested==="baslangic"&&typeof window!=="undefined"&&sessionStorage.getItem("company-invite-code"))return "profil";}catch{}return requested;});
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

  useEffect(()=>{if(tab&&tab!=="ilanlarim"&&tab!=="genel")return;const controller=new AbortController();fetch('/api/listing-draft',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?apiJson<{draft?:import('@/lib/listing-drafts').DraftRecord|null}>(r):{draft:null}).then(data=>{if(!controller.signal.aborted)setDraft(data.draft||null);}).catch(()=>{});return()=>controller.abort();},[tab]);
  async function logout() {
    await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }

  async function removeFavorite(id:string) {
    const response=await fetch(`/api/favorites?id=${encodeURIComponent(id)}`,{method:"DELETE"});
    if(response.ok){setFavorites(items=>items.filter(item=>item.id!==id));favoritesChanged();}
  }

  if (loading || !user || !user.email_verified) return <main className="account-page"><div className="container section">{t(loading ? "Hesabınız yükleniyor..." : "Giriş sayfasına yönlendiriliyorsunuz...")}</div></main>;

  // One panel per account type (lib/account-panel.ts): individuals, agents, contractors and service firms.
  const kind:AccountKind=user.accountKind||(user.role==="agent"?"agent":"individual");
  const items=panelTabs(kind,{hasListings:mine.length>0,developer:user.companyCategory==="developer"}).map(item=>({...item,icon:ICONS[item.id]}));
  const active=panelTab(tab,items);
  // Firm panels live in their own sub-site (/hizmetler/panel, /muteahhitler/panel); Hesabım keeps messages and settings.
  const firmPanel=active==="hizmet"?"/hizmetler/panel":active==="muteahhit"?"/muteahhitler/panel":null;
  if(firmPanel&&typeof window!=="undefined"){const bolum=new URLSearchParams(window.location.search).get("bolum");window.location.replace(firmPanel+(bolum?"?bolum="+encodeURIComponent(bolum):""));return <main className="account-page"><div className="container section">{t("Firma panelinize yönlendiriliyorsunuz...")}</div></main>;}

  return <main className="account-page">
    <div className="account-head"><div className="container"><span className="eyebrow dark-eyebrow">{t("ESTATEMARKET24 HESABIM")}</span><h1>{t("Hoş geldiniz,")} <em>{user.name.split(" ")[0]}.</em></h1><p>{t("Yaşam alanlarınızı ve görüşmelerinizi buradan yönetin.")}</p></div></div>
    <div className="container account-layout">
      <aside className="account-sidebar">
        <div className="account-user">{user.avatar_url ? <img src={user.avatar_url} alt="" width={42} height={42} className="account-avatar-img"/> : <div>{user.name.charAt(0).toUpperCase()}</div>}<span><strong>{user.name}</strong><small>{user.email}</small></span></div>
        <div className="account-nav">
          {items.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setTab(item.id); history.replaceState(null, "", `/hesabim?tab=${item.id}`); }}><item.icon size={17}/>{t(item.label)}</button>)}
          {user.isAdmin && <Link href="/yonetim"><LayoutDashboard size={17}/>{t("Yönetim Paneli")}</Link>}
          <button className="account-logout" onClick={logout}><LogOut size={17}/>{t("Çıkış Yap")}</button>
        </div>
      </aside>
      <section className={`account-content ${active === "mesajlar" ? "account-content-inbox" : ""}`}>
        {draft&&draftHasContent(draft.payload)&&(active==="genel"||active==="ilanlarim")&&<div className="draft-dashboard-card"><div><strong>{draft.payload.fields.title||t("Tamamlanmamış ilanınız var")}</strong><p>{t("Taslak")} · {new Date(draft.updatedAt).toLocaleString(locale)}</p></div><Link href="/ilan-ver">{t("Taslağa devam et")}<ForwardArrow/></Link></div>}
        {active === "genel" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("GENEL BAKIŞ")}</span><h2>{t("Hesabınızın özeti")}</h2></div>{(kind==="individual"||kind==="agent")&&<Link href="/ilan-ver" className="small-primary">{t("Yeni ilan ver")}<Plus size={17}/></Link>}</div>
          {(kind==="contractor"||kind==="service")?<div className="panel-note"><h3>{t(kind==="contractor"?"Müteahhit firmanız":"Hizmet firmanız")}</h3><p>{t(kind==="contractor"?"Firma profilinizi, tamamlanan projelerinizi ve gelen kat karşılığı taleplerini Firma panelim bölümünden yönetin.":"Firma profilinizi, çalışma bilgilerinizi, belgelerinizi ve gelen teklif taleplerini Firma panelim bölümünden yönetin.")}</p><button type="button" className="text-link" onClick={()=>window.location.assign(kind==="contractor"?"/muteahhitler/panel":"/hizmetler/panel")}>{t("Firma panelime git")}<ArrowUpRight size={16}/></button></div>:<>
          <div className="summary-cards"><div><Heart size={22}/><strong>{favorites.length}</strong><span>{t("Favori ilan")}</span></div><div><Bookmark size={22}/><strong>{mine.length}</strong><span>{t("İlanım")}</span></div><div><Mail size={22}/><strong>{conversations.length}</strong><span>{t("Görüşme")}</span></div></div>
          <div className="panel-note"><h3>{t("Yeni bir yaşam alanı keşfedin")}</h3><p>{t("Aradığınız özelliklere uygun ilanları gelişmiş filtrelerle bulun.")}</p><Link className="text-link" href="/ilanlar">{t("İlanları incele")}<ArrowUpRight size={16}/></Link></div></>}
          {user.role==="agent"&&<FeedbackCard/>}
        </>}
        {active === "favoriler" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("KAYDETTİKLERİNİZ")}</span><h2>{t("Favori ilanlarım")}</h2></div></div>
          {favorites.length ? <div className="favorite-dashboard-grid">{favorites.map(listing=><article className="favorite-dashboard-card" key={listing.id}><Link href={`/ilan/${listing.id}`}><img src={listing.images[0]?photoVariantUrl(listing.images[0],640):undefined} alt="" loading="lazy" decoding="async"/><div><h3>{locale==="tr"?listing.title:listing.translations?.[locale]?.title||listing.title}</h3><p>{listing.district}, {listing.city} · {listing.grossArea} m²</p><strong><DisplayMoney value={listing.price} currency={listing.currency}/></strong></div></Link><button type="button" onClick={()=>removeFavorite(listing.id)} aria-label={t("Favorilerden çıkar")}><Heart size={17} fill="currentColor"/>{t("Favorilerden çıkar")}</button></article>)}</div> : <div className="panel-empty"><Heart size={28}/><h3>{t("Henüz favori ilanınız yok.")}</h3><Link href="/ilanlar">{t("İlanlara göz atın")}<ForwardArrow/></Link></div>}

        </>}
        {active === "ilanlarim" && <>
          <div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLAN YÖNETİMİ")}</span><h2>{t("İlanlarım")}</h2></div><Link href="/ilan-ver" className="small-primary">{t("İlan ver")}<Plus size={17}/></Link></div>
          {user.role==="individual"&&!user.isAdmin&&<IndividualPolicyNotice/>}{user.role==="agent"&&user.agent_status==="approved"&&<p className="profile-save-success">{t("Onaylı emlakçı hesabınızla ilanlarınız doğrudan yayımlanır.")}</p>}{(user.role==="agent"||user.role==="buyer")&&<AgentLanguagesSetting/>}
          {mine.length ? <ManagedListings listings={mine} onChange={setMine}/> : <div className="panel-empty"><Bookmark size={28}/><h3>{t("Henüz ilan eklemediniz.")}</h3><Link href="/ilan-ver">{t("İlk ilanınızı oluşturun")}<ForwardArrow/></Link></div>}

        </>}
        {active === "mesajlar" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("İLETİŞİM")}</span><h2>{t("Mesajlarım")}</h2></div></div><MessagesInbox userId={user.id} initialConversations={conversations}/></>}
        {active === "aramalar" && <><MyHomeRequests/><EmailPreferences/><DiscoveryPanel/><MyReports/></>}{active==="randevular"&&<AppointmentsPanel userId={user.id}/>}{active==="crm"&&kind==="agent"&&user.agent_status==="approved"&&<AgentHomeRequests/>}{active==="crm"&&<CrmPanel userId={user.id} title={kind==="agent"?"Müşteri ve ilan takibi":"İlan istatistikleri"} appointments={kind==="agent"}/>}{active==="siparisler"&&<MyOrders/>}{active==="projelerim"&&(user.role==="agent"||user.isAdmin)&&<ProjectsPanel/>}{active==="teklifler"&&<><ServiceQuotesPanel/><LandRequestsPanel/></>}
        {active === "ekip" && <CompanyTeam/>}
        {active === "firma" && user.role==='agent' && <><CompanyAccount/><OfficeVerification/></>}
        {active === "profil" && <><div className="panel-heading"><div><span className="eyebrow dark-eyebrow">{t("HESAP BİLGİLERİ")}</span><h2>{t("Profilim")}</h2></div></div><div className="profile-facts"><div><span>{t("Ad Soyad")}</span><strong>{user.name}</strong></div><div><span>{t("E-posta")}</span><strong>{user.email}</strong></div><div><span>{t("Hesap türü")}</span><strong>{t(user.role === "agent" ? user.companyCategory==="developer"?"İnşaat firması":"Emlakçı" : ACCOUNT_KIND_LABELS[kind])}</strong></div>{user.role === "agent" && <div><span>{t("Onay durumu")}</span><strong>{t(user.agent_status === "approved" ? "Onaylandı" : "İnceleniyor")}</strong></div>}</div><ProfileEditor user={user} onSaved={saved=>setUser(old=>old?{...old,...saved}:old)}/>{kind!=="agent"&&!user.isAdmin&&<AccountKindSwitch kind={kind} onChanged={next=>{setUser(old=>old?{...old,accountKind:next}:old);setTab("genel");history.replaceState(null,"","/hesabim?tab=profil");}}/>}{kind==="individual"&&<SellerUpgrade user={user}/>}{kind==="individual"&&<CompanyTeam/>}{kind!=="individual"&&<EmailPreferences/>}<AccountSecurity isAdmin={Boolean(user.isAdmin)}/></>}
      </section>
    </div>
  </main>;
}
