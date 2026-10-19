"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, Building2 } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";
import { CompanyCard } from "./CompanyCard";

export function CompanyDirectory({ preview = false }: { preview?: boolean }) {
  const { t } = useLocale();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const query = new URLSearchParams({ page: String(preview ? 1 : page) });
    if (category && !preview) query.set("category", category);
    fetch(`/api/companies?${query}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Şirketler yüklenemedi."); return response.json() as Promise<{ companies: Company[]; total: number }>; })
      .then((data) => { setCompanies(data.companies || []); setTotal(data.total || 0); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, page, preview]);

  if (preview) return <div className="company-preview">
    {loading ? <p className="directory-state">{t("Şirketler yükleniyor...")}</p> : failed ? <p className="directory-state">{t("Şirketler şu anda yüklenemedi.")}</p> : companies.length ? companies.slice(0, 3).map((company) => <CompanyCard key={company.id} company={company}/>) : <div className="company-empty"><Building2 size={28}/><strong>{t("Onaylı şirketler burada görünecek.")}</strong><p>{t("Emlak ofisleri ve inşaat firmaları onaylandıktan sonra portföyleriyle listelenir.")}</p><Link href="/giris?role=agent&next=%2Fhesabim">{t("Şirket hesabı oluştur")} <ArrowRight size={16}/></Link></div>}
  </div>;

  return <main className="directory-page"><div className="container">
    <div className="directory-heading"><span className="market-overline">ESTATEMARKET24 / {t("İş ortakları")}</span><h1>{t("Emlak ofisleri ve inşaat firmaları")}</h1><p>{t("Onaylı şirketleri ve sunum amaçlı örnek portföyleri inceleyin.")}</p></div>
    <div className="directory-tabs" role="group" aria-label={t("Şirket türü")}>
      {[{ value: "", label: "Tüm şirketler" }, { value: "agency", label: "Emlak ofisleri" }, { value: "developer", label: "İnşaat firmaları" }].map((item) => <button key={item.value} type="button" className={category === item.value ? "active" : ""} onClick={() => { setCategory(item.value); setPage(1); }}>{t(item.label)}</button>)}
    </div>
    {loading ? <p className="directory-state">{t("Şirketler yükleniyor...")}</p> : failed ? <p className="directory-state">{t("Şirketler şu anda yüklenemedi.")}</p> : companies.length ? <><div className="directory-count">{total} {t("şirket ve örnek profil")}</div><div className="directory-grid">{companies.map((company) => <CompanyCard key={company.id} company={company}/>)}</div><div className="directory-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Önceki")}</button><span>{page} / {Math.max(1, Math.ceil(total / 24))}</span><button disabled={page * 24 >= total} onClick={() => setPage(page + 1)}>{t("Sonraki")}</button></div></> : <div className="company-empty"><Building2 size={32}/><strong>{t("Henüz onaylı şirket yok.")}</strong><p>{t("Şirketler yönetici onayından sonra burada görünür.")}</p><Link href="/giris?role=agent&next=%2Fhesabim">{t("Şirket hesabı oluştur")} <ArrowRight size={16}/></Link></div>}
  </div></main>;
}
