"use client";
import {ArrowLeft,ArrowRight,ExternalLink,Landmark,TriangleAlert} from 'lucide-react';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {CITIZENSHIP_AS_OF,CITIZENSHIP_SOURCES,FOREIGN_BUYER_PATH,citizenshipGuide} from '@/lib/citizenship-guide';

export function CitizenshipGuide(){
 const {locale}=useLocale();const guide=citizenshipGuide[locale];
 const asOf=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${CITIZENSHIP_AS_OF}T00:00:00Z`));
 return <main className="citizenship-page">
  <section className="citizenship-hero"><div className="container"><Link className="citizenship-back" href={FOREIGN_BUYER_PATH}><ArrowLeft size={16}/>{guide.back}</Link><span className="buyer-guide-eyebrow">{guide.eyebrow}</span><h1>{guide.title}</h1><p>{guide.intro}</p><p className="citizenship-asof">{guide.asOf}: <time dateTime={CITIZENSHIP_AS_OF}>{asOf}</time></p></div></section>
  <div className="container citizenship-layout">
   <article className="citizenship-main">
    <section className="citizenship-facts" aria-labelledby="citizenship-facts"><h2 id="citizenship-facts"><Landmark size={20}/>{guide.factsTitle}</h2><dl>{guide.facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    {guide.sections.map(section=><section key={section.title} className="citizenship-section"><h2>{section.title}</h2><ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul></section>)}
    <section className="citizenship-section"><h2>{guide.stepsTitle}</h2><ol className="citizenship-steps">{guide.steps.map(([heading,text])=><li key={heading}><h3>{heading}</h3><p>{text}</p></li>)}</ol></section>
    <section className="citizenship-section"><h2>{guide.timingTitle}</h2><p>{guide.timing}</p></section>
    <section className="citizenship-disclaimer" role="note"><TriangleAlert size={20} aria-hidden="true"/><div><strong>{guide.disclaimerTitle}</strong><p>{guide.disclaimer}</p></div></section>
    <section className="citizenship-section citizenship-sources"><h2>{guide.sourcesTitle}</h2><p className="citizenship-asof">{guide.asOf}: <time dateTime={CITIZENSHIP_AS_OF}>{asOf}</time></p><ol>{CITIZENSHIP_SOURCES.map((url,index)=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{guide.sources[index]}<ExternalLink size={13} aria-hidden="true"/></a></li>)}</ol></section>
   </article>
   <aside className="citizenship-aside"><Link className="primary-button" href="/ilanlar?purpose=satilik&foreignSale=1">{guide.listings}<ArrowRight size={17}/></Link><Link className="outline-button" href={FOREIGN_BUYER_PATH}>{guide.back}<ArrowRight size={17}/></Link></aside>
  </div>
 </main>;
}
