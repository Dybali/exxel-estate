"use client";
import {ArrowRight, BookOpen, ChevronDown, Globe2} from 'lucide-react';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {foreignBuyerGuide} from '@/lib/foreign-buyer-guide';

export function ForeignBuyerGuide(){
 const {locale}=useLocale();const guide=foreignBuyerGuide[locale];
 return <section className="buyer-guide-section" aria-labelledby="buyer-guide-title"><div className="container"><div className="buyer-guide-card"><div className="buyer-guide-intro"><span className="buyer-guide-icon"><Globe2 size={23}/></span><span className="buyer-guide-eyebrow">{guide.eyebrow}</span><h2 id="buyer-guide-title">{guide.title}</h2><p>{guide.intro}</p><Link href="/ilanlar?purpose=satilik" className="buyer-guide-search">{guide.view}<ArrowRight size={17}/></Link></div><div className="buyer-guide-content"><div className="buyer-guide-cover"><BookOpen size={22}/><p>{guide.summary}</p></div><details className="buyer-guide-details"><summary><span>{guide.read}</span><ChevronDown size={19}/></summary><div className="buyer-guide-body"><ol>{guide.steps.map(([heading,description])=><li key={heading}><h3>{heading}</h3><p>{description}</p></li>)}</ol><p className="buyer-guide-note">{guide.note}</p><div className="buyer-guide-sources"><strong>{guide.sources}</strong><a href="https://www.invest.gov.tr/en/investmentguide/pages/acquiring-property-and-citizenship.aspx" target="_blank" rel="noopener noreferrer">{guide.registry} ↗</a><a href="https://www.tkgm.gov.tr/duyurular/yabanci-gercek-kisi-edinimlerinde-doviz-alim-belgesi-hakkinda-duyuru" target="_blank" rel="noopener noreferrer">{guide.bank} ↗</a><a href="https://en.goc.gov.tr/residence-permit-types" target="_blank" rel="noopener noreferrer">{guide.residence} ↗</a></div></div></details></div></div></div></section>;
}
