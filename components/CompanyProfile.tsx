"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowLeft, Building2, HardHat } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";
import type { Listing } from "@/lib/listings";
import { ListingCard } from "./ListingCard";

export function CompanyProfile({ id }: { id: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<{ company: Company; listings: Listing[]; page: number; pageSize: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [page, setPage] = useState(1);
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
      <div className="company-profile-head"><span className="company-profile-mark">{data.company.avatarUrl?<img src={data.company.avatarUrl} alt={data.company.name}/>:data.company.category === "developer" ? <HardHat size={30}/> : <Building2 size={30}/>}</span><div><span className="market-overline">{t(data.company.category === "developer" ? "İnşaat firması" : "Emlak ofisi")}{data.company.sample && <em className="company-sample-tag">{t("Örnek profil")}</em>}</span><h1>{data.company.name}</h1>{data.company.description&&<p className="company-profile-description" style={{whiteSpace:"pre-wrap"}}>{data.company.city?data.company.city+" · ":""}{t(data.company.description)}</p>}{data.company.ownerId&&<Link className="property-profile-link" href={"/profil/"+data.company.ownerId}>Danışman profili ve ilanları →</Link>}<p>{data.company.listingCount} {t(data.company.sample ? "örnek ilan" : "yayındaki ilan")} · {data.company.saleCount} {t("satılık")} · {data.company.rentCount} {t("kiralık")}</p></div></div>
      {data.company.sample && <p className="company-demo-disclosure">{t("Bu şirket ve portföyü sunum amaçlı örnektir; gerçek bir satıcıyı temsil etmez.")}</p>}
      <div className="market-section-head company-listings-head"><div><span className="market-overline">{t("Portföy")}</span><h2>{t(data.company.sample ? "Örnek ilanlar" : "Yayındaki ilanlar")}</h2></div></div>
      {listings.length ? <><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div>{!data.company.sample && data.company.listingCount > data.pageSize && <div className="directory-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Önceki")}</button><span>{page} / {Math.ceil(data.company.listingCount / data.pageSize)}</span><button disabled={page * data.pageSize >= data.company.listingCount} onClick={() => setPage(page + 1)}>{t("Sonraki")}</button></div>}</> : <p className="directory-state">{t("Bu şirketin henüz yayında ilanı yok.")}</p>}
    </>}
  </main>;
}

