"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Building2, HardHat, MapPin } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";
import type { Listing } from "@/lib/listings";
import { ListingCard } from "./ListingCard";

export function CompanyProfile({ id }: { id: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<{ company: Company; listings: Listing[]; page: number; pageSize: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"listings"|"about">("listings");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/companies/${encodeURIComponent(id)}?page=${page}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("missing"); return response.json() as Promise<{ company: Company; listings: Listing[]; page: number; pageSize: number }>; })
      .then((value) => { setData(value); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("missing"); });
    return () => controller.abort();
  }, [id, page]);
  const listings = data?.listings || [];
  return <main className="company-profile container"><Link className="company-back" href="/sirketler"><ArrowLeft size={16}/>{t("Tüm şirketler")}</Link>
    {state === "loading" ? <p className="directory-state">{t("Şirketler yükleniyor...")}</p> : !data || state === "missing" ? <div className="company-empty"><strong>{t("Şirket bulunamadı.")}</strong><Link href="/sirketler">{t("Tüm şirketler")} →</Link></div> : <>
      <section className="portfolio-hero">
        <div className="portfolio-cover">{data.company.coverUrl&&<img src={data.company.coverUrl} alt={t("Temsili mimari fotoğraf")}/>}</div>
        <div className="portfolio-identity"><span className="portfolio-logo">{data.company.avatarUrl?<img src={data.company.avatarUrl} alt={data.company.name}/>:data.company.initials?<b>{data.company.initials}</b>:data.company.category === "developer" ? <HardHat size={38}/> : <Building2 size={38}/>}</span><div className="portfolio-identity-text"><span className="market-overline">{t(data.company.category === "developer" ? "İnşaat firması" : "Emlak ofisi")}</span><h1>{data.company.name}</h1><div className="portfolio-meta">{data.company.city&&<span><MapPin size={15}/>{data.company.city}</span>}{!data.company.sample&&<span><BadgeCheck size={15}/>{t("Onaylı şirket profili")}</span>}{data.company.sample&&<span className="company-sample-tag">{t("Örnek profil")}</span>}</div></div>{data.company.ownerId&&<Link className="portfolio-contact" href={'/profil/'+data.company.ownerId}>{t('Danışman profili ve ilanları')} <ArrowUpRight size={16}/></Link>}</div>
      </section>
      {data.company.sample && <p className="company-demo-disclosure">{t("Bu şirket ve portföyü sunum amaçlı örnektir; gerçek bir satıcıyı temsil etmez.")}</p>}
      <nav className="portfolio-nav" aria-label={t('Şirket portföyü')}><button type="button" className={tab==='listings'?'active':''} aria-current={tab==='listings'?'page':undefined} onClick={()=>setTab('listings')}>{t('Tüm ilanlar')}</button><button type="button" className={tab==='about'?'active':''} aria-current={tab==='about'?'page':undefined} onClick={()=>setTab('about')}>{t('Hakkımızda')}</button><span>{t('Portföy')} · <strong>{data.company.project?'1':data.company.listingCount}</strong> {t(data.company.project?'örnek proje':'ilan')}</span></nav>
      {tab==='about'?<section className="portfolio-about"><span className="market-overline">{t('Şirket hakkında')}</span><h2>{t('Hakkımızda')}</h2><p>{data.company.description?t(data.company.description):t('Bu şirket henüz tanıtım yazısı eklemedi.')}</p>{data.company.ownerId&&<Link href={'/profil/'+data.company.ownerId}>{t('Danışman profili ve ilanları')} <ArrowUpRight size={15}/></Link>}</section>:<>
      <div className="market-section-head company-listings-head"><div><span className="market-overline">{t("Portföy")}</span><h2>{t(data.company.project?"Örnek proje":data.company.sample ? "Örnek ilanlar" : "Yayındaki ilanlar")}</h2></div></div>
      {data.company.project&&<section className="sample-project-details"><h3>{data.company.project.name}</h3><p>{t(data.company.project.description)}</p><div className="sample-project-features">{data.company.project.features.map(feature=><span key={feature}>{t(feature)}</span>)}</div><p>{t("Firma ve projeler sunum amaçlı örnektir. Fotoğraflar temsilidir; satış teklifi değildir.")}</p><Link href="/kurumsal-uyelik">{t("İnşaat firması üyeliği")} →</Link>{data.company.photoCredit&&<p className="sample-project-credit">{t("Fotoğraf")}: <a href={data.company.photoCredit.url} target="_blank" rel="noreferrer">{data.company.photoCredit.label}</a></p>}</section>}
      {listings.length ? <><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div>{!data.company.sample && data.company.listingCount > data.pageSize && <div className="directory-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Önceki")}</button><span>{page} / {Math.ceil(data.company.listingCount / data.pageSize)}</span><button disabled={page * data.pageSize >= data.company.listingCount} onClick={() => setPage(page + 1)}>{t("Sonraki")}</button></div>}</> : data.company.project?null:<p className="directory-state">{t("Bu şirketin henüz yayında ilanı yok.")}</p>}
      </>}
    </>}
  </main>;
}

