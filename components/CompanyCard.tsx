"use client";

import Link from "@/components/SafeLink";
import { ArrowUpRight, Building2, HardHat } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";

export function CompanyCard({ company }: { company: Company }) {
  const { t } = useLocale();
  if(company.coverUrl)return <Link className="company-card company-card-visual" href={`/sirketler/${company.id}`}>
    <div className="company-card-cover"><img src={company.coverUrl} alt={t('Temsili mimari fotoğraf')} width={640} height={360} loading="lazy" decoding="async"/>{company.sample&&<span>{t('Örnek firma')}</span>}</div>
    <div className="company-visual-body"><span className="company-initials" aria-hidden="true">{company.initials||company.name.slice(0,2)}</span><span className="company-card-main"><small>{t('İnşaat firması')}</small><strong>{company.name}</strong><span className="company-card-city">{company.city}</span><span>{company.project?'1 '+t('örnek proje'):company.listingCount+' '+t('yayındaki ilan')}</span></span><ArrowUpRight className="company-card-arrow" size={20}/></div>
  </Link>;
  return <Link className="company-card" href={`/sirketler/${company.id}`}>
    <span className="company-card-mark" aria-hidden="true">{company.category === "developer" ? <HardHat size={25}/> : <Building2 size={25}/>}</span>
    <span className="company-card-main"><small>{t(company.category === "developer" ? "İnşaat firması" : "Emlak ofisi")}{company.sample && <em className="company-sample-tag">{t("Örnek profil")}</em>}</small><strong>{company.name}</strong>{company.city && <span className="company-card-city">{company.city}</span>}<span>{company.listingCount} {t(company.sample ? "örnek ilan" : "yayındaki ilan")} · {company.saleCount} {t("satılık")} · {company.rentCount} {t("kiralık")}</span></span>
    <ArrowUpRight className="company-card-arrow" size={20}/>
  </Link>;
}
