'use client';
import Link from './SafeLink';
import {ArrowUpRight,MapPin} from 'lucide-react';
import {SAMPLE_DEVELOPERS} from '@/lib/developer-showcase';
import {useLocale} from '@/lib/i18n';
export function DeveloperShowcase(){
  const {t}=useLocale();
  return <section className="market-section container developer-showcase" aria-labelledby="developer-showcase-title">
    <div className="market-section-head"><div><span className="market-overline">{t('PROJE TANITIMLARI')}</span><h2 id="developer-showcase-title">{t('Yeni bir yaşamın ilk adımı.')}</h2><p>{t('İnşaat firmalarının proje vitrinlerini keşfedin.')}</p></div><Link href="/sirketler" className="market-more">{t('Firmaları keşfet')}<ArrowUpRight size={17}/></Link></div>
    <div className="developer-ad-grid">{SAMPLE_DEVELOPERS.map((company,index)=><Link key={company.id} href={`/sirketler/${company.id}`} className={`developer-ad developer-ad-${index}`} aria-label={company.name+' · '+company.project?.name}>
      <img src={company.coverUrl} alt={t('Temsili mimari fotoğraf')} width={1200} height={820} loading="lazy" decoding="async"/>
      <div className="developer-ad-top"><span className="developer-ad-brand"><b>{company.initials}</b>{company.name}</span><span className="developer-ad-label">{t('Örnek tanıtım')}</span></div>
      <div className="developer-ad-copy"><span className="developer-ad-city"><MapPin size={13}/>{company.city}</span><h3>{company.project?.name}</h3><p>{t(company.project?.description||'')}</p><span className="developer-ad-link">{t('Firma profilini gör')}<ArrowUpRight size={17}/></span></div>
    </Link>)}</div>
    <div className="developer-showcase-note"><p>{t('Firma ve projeler sunum amaçlı örnektir. Fotoğraflar temsilidir; satış teklifi değildir.')}</p><details><summary>{t('Fotoğraf kaynakları')}</summary>{SAMPLE_DEVELOPERS.map(company=><a key={company.id} href={company.photoCredit?.url} target="_blank" rel="noreferrer">{company.city} · {company.photoCredit?.label}</a>)}</details></div>
  </section>;
}
