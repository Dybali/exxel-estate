"use client";
import Link from "@/components/SafeLink";
import {Building2, CalendarDays, MapPin} from "lucide-react";
import {VerifiedBadge} from "@/components/VerifiedBadge";
import {useLocale} from "@/lib/i18n";
import {formatPrice} from "@/lib/listings";
import {PROJECT_STATUS_LABELS, priceFrom, type Project} from "@/lib/projects";

// "2027-06" → "June 2027" in the visitor's language.
export function deliveryLabel(value: string | null, locale: string) {
  if (!value) return "";
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {month: "long", year: "numeric", timeZone: "UTC"}).format(date);
}

export function ProjectPriceFrom({project}: {project: Pick<Project, "unitTypes">}) {
  const {t, locale} = useLocale();
  const prices = priceFrom(project);
  if (!prices.length) return null;
  return <strong className="project-price">{prices.map(({currency, amount}) => t("{price}'den itibaren").replace("{price}", formatPrice(amount, currency, locale))).join(" · ")}</strong>;
}

export function ProjectStatusBadge({status}: {status: Project["status"]}) {
  const {t} = useLocale();
  return <span className={`project-status-badge ${status}`}>{t(PROJECT_STATUS_LABELS[status])}</span>;
}

export function ProjectCard({project}: {project: Project}) {
  const {t, locale} = useLocale();
  const cover = project.images[0];
  return <article className="project-card">
    <Link href={`/projeler/${project.id}`} className="project-card-photo">
      {cover ? <img src={cover} alt={project.name} loading="lazy"/> : <span aria-hidden="true"><Building2 size={40}/></span>}
      <ProjectStatusBadge status={project.status}/>
    </Link>
    <div className="project-card-body">
      <h2><Link href={`/projeler/${project.id}`}>{project.name}</Link></h2>
      <p className="project-card-location"><MapPin size={14}/>{[project.neighborhood, project.district, project.city].filter(Boolean).join(", ")}</p>
      {project.deliveryDate && <p className="project-card-delivery"><CalendarDays size={14}/>{t("Teslim")}: {deliveryLabel(project.deliveryDate, locale)}</p>}
      <div className="project-room-chips">{project.unitTypes.map((unit) => <span key={unit.rooms}>{unit.rooms === "1+0" ? t("Stüdyo") : unit.rooms}</span>)}</div>
      <ProjectPriceFrom project={project}/>
      <div className="project-card-owner"><span>{project.ownerName}</span>{project.ownerVerified && <VerifiedBadge compact/>}</div>
    </div>
  </article>;
}
