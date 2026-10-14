"use client";

import Link from "@/components/SafeLink";
import { ArrowUpRight, Building2, HardHat } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import type { Company } from "@/lib/companies";

export function CompanyCard({ company }: { company: Company }) {
  const { t } = useLocale();
  return <Link className="company-card" href={`/sirketler/${company.id}`}>
    <span className="company-card-mark" aria-hidden="true">{company.category === "developer" ? <HardHat size={25}/> : <Building2 size={25}/>}</span>
    <span className="company-card-main"><small>{t(company.category === "developer" ? "İnşaat firması" : "Emlak ofisi")}</small><strong>{company.name}</strong><span>{company.listingCount} {t("yayındaki ilan")} · {company.saleCount} {t("satılık")} · {company.rentCount} {t("kiralık")}</span></span>
    <ArrowUpRight className="company-card-arrow" size={20}/>
  </Link>;
}
