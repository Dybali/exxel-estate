"use client";
import { ViewerGate } from "@/components/ViewerGate";

import { ForwardArrow } from "@/components/DirectionalArrow";
import {VerifiedBadge} from "@/components/VerifiedBadge";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Building2, HardHat, MapPin, UserRound } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";
import type { Listing } from "@/lib/listings";
import { ListingCard } from "./ListingCard";
import { PhoneButton, useLanguageName } from "./AgentDirectory";
import { TEAM_TITLES, type TeamTitle } from "@/lib/company-office";

// Office page like the big portals (2026-11-17, lib/company-office.ts): licence and phone in the header, the
// consultants in a side list with "Danışmanın ilanları", and the languages the office serves.
type Member={id:string;name:string;avatar_url:string|null;listing_count:number;title:string;owner:boolean;languages:string[]};
type Data={ company: Company; listings: Listing[]; team?:Member[]; languages?:string[]; consultant?:{id:string;name:string}|null; page: number; pageSize: number };
const FLAGS:Record<string,string>={tr:"tr",de:"de",en:"gb",fr:"fr",nl:"nl",ru:"ru",ar:"sa",fa:"ir"};
const titleOf=(title:string)=>TEAM_TITLES[title as TeamTitle]||TEAM_TITLES.consultant;

export function CompanyProfile({ id }: { id: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<Data | null>(null), [consultant, setConsultant] = useState<string | null>(null);
  const language = useLanguageName();
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"listings"|"featured"|"team"|"about">("listings");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/companies/${encodeURIComponent(id)}?page=${page}${tab==='featured'?'&featured=1':''}${consultant?`&danisman=${encodeURIComponent(consultant)}`:''}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("missing"); return response.json() as Promise<Data>; })
      .then((value) => { setData(value); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("missing"); });
    return () => controller.abort();
  }, [id, page, tab === "featured", consultant]);
  const pick = (member: string | null) => { setConsultant(member); setPage(1); setTab("listings"); };
  const listings = data?.listings || [];
  return <main className="company-profile container"><Link className="company-back" href="/sirketler"><ArrowLeft size={16}/>{t("Tüm şirketler")}</Link>
    {state === "loading" ? <p className="directory-state">{t("Şirketler yükleniyor...")}</p> : !data || state === "missing" ? <div className="company-empty"><Building2 size={28}/><strong>{t("Şirket bulunamadı.")}</strong><Link className="outline-button" href="/sirketler">{t("Tüm şirketler")}<ForwardArrow/></Link></div> : <>
      <section className="portfolio-hero">
        <div className="portfolio-cover">{data.company.coverUrl&&<img src={data.company.coverUrl} alt={t("Temsili mimari fotoğraf")}/>}</div>
        <div className="portfolio-identity"><span className="portfolio-logo">{data.company.avatarUrl?<img src={data.company.avatarUrl} alt={data.company.name}/>:data.company.initials?<b>{data.company.initials}</b>:data.company.category === "developer" ? <HardHat size={38}/> : <Building2 size={38}/>}</span><div className="portfolio-identity-text"><span className="market-overline">{t(data.company.category === "developer" ? "İnşaat firması" : "Emlak ofisi")}</span><h1>{data.company.name}</h1><div className="portfolio-meta">{data.company.city&&<span><MapPin size={15}/>{data.company.city}</span>}{!data.company.sample&&<span><BadgeCheck size={15}/>{t("Onaylı şirket profili")}</span>}{data.company.authorityNumber&&<VerifiedBadge/>}{data.company.authorityNumber&&<span>{t("Taşınmaz ticareti yetki belgesi no")}: {data.company.authorityNumber}</span>}{data.company.sample&&<span className="company-sample-tag">{t("Örnek profil")}</span>}</div></div>{data.company.ownerId&&!data.company.sample&&<div className="office-contact">{data.company.authorityNumber&&<div className="office-licence"><BadgeCheck size={16} aria-hidden="true"/><span><strong>{t('Taşınmaz Ticareti Yetki Belgesi')}</strong><bdi>{data.company.authorityNumber}</bdi></span></div>}<PhoneButton id={data.company.ownerId}/></div>}</div>
      </section>
      {data.company.sample && <p className="company-demo-disclosure">{t("Bu şirket ve portföyü sunum amaçlı örnektir; gerçek bir satıcıyı temsil etmez.")}</p>}
      <nav className="portfolio-nav" aria-label={t('Şirket portföyü')}><button type="button" className={tab==='listings'?'active':''} aria-current={tab==='listings'?'page':undefined} onClick={()=>{setPage(1);setTab('listings')}}>{t('Tüm ilanlar')}</button><button type="button" className={tab==='featured'?'active':''} onClick={()=>{setPage(1);setTab('featured')}}>{t('Öne çıkanlar')}</button><button type="button" className={tab==='team'?'active':''} onClick={()=>setTab('team')}>{t('Ekibimiz')}</button><button type="button" className={tab==='about'?'active':''} aria-current={tab==='about'?'page':undefined} onClick={()=>setTab('about')}>{t('Hakkımızda')}</button><span>{t('Portföy')} · <strong>{data.company.project?'1':data.company.listingCount}</strong> {t(data.company.project?'örnek proje':'ilan')}</span></nav>
      {tab==='team'?<section className="portfolio-about"><h2>{t('Ekibimiz')}</h2>{data.team?.length?<div className="portfolio-team">{data.team.map(member=><Link href={'/profil/'+member.id} key={member.id} className="portfolio-team-card">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<UserRound size={38}/>}<span><strong>{member.name}</strong><small>{t(titleOf(member.title))} · {member.listing_count} {t('yayındaki ilan')}</small></span><ArrowUpRight size={18}/></Link>)}</div>:<p>{t('Bu şirket henüz ekip üyesi eklemedi.')}</p>}</section>:tab==='about'?<section className="portfolio-about"><span className="market-overline">{t('Şirket hakkında')}</span><h2>{t('Hakkımızda')}</h2><p>{data.company.description?t(data.company.description):t('Bu şirket henüz tanıtım yazısı eklemedi.')}</p>{data.company.ownerId&&<Link href={'/profil/'+data.company.ownerId}>{t('Danışman profili ve ilanları')} <ArrowUpRight size={15}/></Link>}</section>:<div className={data.company.sample?"":"office-layout"}>{!data.company.sample&&<aside className="office-aside">
        {data.team&&data.team.length>0&&<section><h2>{t('Danışmanlarımız')}</h2><ul className="office-team">{data.team.map(member=><li key={member.id} className={consultant===member.id?'active':''}>{member.avatar_url?<img src={member.avatar_url} alt="" loading="lazy"/>:<span className="office-avatar" aria-hidden="true">{member.name.charAt(0)}</span>}<div><strong>{member.name}</strong><small>{t(titleOf(member.title))}</small><button type="button" onClick={()=>pick(member.id)}>{t('Danışmanın ilanları')} ({member.listing_count}) <ArrowUpRight size={13} aria-hidden="true"/></button></div></li>)}</ul></section>}
        {data.languages&&data.languages.length>0&&<section><h2>{t('Hizmet verdiğimiz diller')}</h2><ul className="office-languages">{data.languages.map(code=><li key={code}>{FLAGS[code]?<img src={`/flags/${FLAGS[code]}.svg`} alt="" width={22} height={15}/>:<b>{code.toUpperCase()}</b>}{language(code)}</li>)}</ul></section>}
      </aside>}<div className="office-main">
      {data.consultant&&<div className="office-filter"><span>{t('{name} için {n} ilan bulundu').replace('{name}',data.consultant.name).replace('{n}',String(data.company.listingCount))}</span><button type="button" className="outline-button" onClick={()=>pick(null)}>{t('Tüm ilanlar')}</button></div>}
      <div className="market-section-head company-listings-head"><div><span className="market-overline">{t("Portföy")}</span><h2>{t(tab==='featured'?"Öne çıkanlar":data.company.project?"Örnek proje":data.company.sample ? "Örnek ilanlar" : "Yayındaki ilanlar")}</h2></div></div>
      {data.company.project&&<section className="sample-project-details"><h3>{data.company.project.name}</h3><p>{t(data.company.project.description)}</p><div className="sample-project-features">{data.company.project.features.map(feature=><span key={feature}>{t(feature)}</span>)}</div><p>{t("Firma ve projeler sunum amaçlı örnektir. Fotoğraflar temsilidir; satış teklifi değildir.")}</p><ViewerGate action="signUp"><Link href="/kurumsal-uyelik">{t("İnşaat firması üyeliği")}<ForwardArrow/></Link></ViewerGate>{data.company.photoCredit&&<p className="sample-project-credit">{t("Fotoğraf")}: <a href={data.company.photoCredit.url} target="_blank" rel="noreferrer">{data.company.photoCredit.label}</a></p>}</section>}
      {listings.length ? <><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div>{!data.company.sample && data.company.listingCount > data.pageSize && <div className="directory-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Önceki")}</button><span>{page} / {Math.ceil(data.company.listingCount / data.pageSize)}</span><button disabled={page * data.pageSize >= data.company.listingCount} onClick={() => setPage(page + 1)}>{t("Sonraki")}</button></div>}</> : data.company.project?null:<p className="directory-state">{t(tab==='featured'?"Henüz öne çıkan ilan yok.":"Bu şirketin henüz yayında ilanı yok.")}</p>}
      </div></div>}
    </>}
  </main>;
}

