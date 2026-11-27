'use client';
import {Fragment, type ReactNode} from 'react';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {SALES_LEGAL_UPDATED, SALES_PAGES, SELLER, SELLER_ROWS, type SalesBlock} from '@/lib/sales-legal';
import {LegalClauses, LegalContactBox, LegalPage, LegalRights} from './LegalPage';
import {CompanyIdentity} from './CompanyIdentity';

// Sales pages for card payments (texts in lib/sales-legal.ts, Turkish only: binding in Turkish). Other site languages
// get a translated note above the text.
function rich(text: string): ReactNode {
  const filled = text.replace(/\{(email|phone|name|address)\}/g, (_, key: keyof typeof SELLER) => SELLER[key]);
  return filled.split(/(\[[^\]]+\]\([^)]+\))/).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return link ? <Link key={index} href={link[2]}>{link[1]}</Link> : <Fragment key={index}>{part}</Fragment>;
  });
}
function SellerCard() {
  return <table className="legal-table"><tbody>{SELLER_ROWS.filter(([, key]) => SELLER[key]).map(([label, key]) => <tr key={key}><th scope="row">{label}</th><td>{SELLER[key]}</td></tr>)}</tbody></table>;
}
function Block({block, section}: {block: SalesBlock; section: number}) {
  if (block.h) return <h3>{block.h}</h3>;
  if (block.p) return <p>{rich(block.p)}</p>;
  if (block.clauses) return <LegalClauses section={section} items={block.clauses.map(rich)}/>;
  if (block.component === 'SellerCard') return <SellerCard/>;
  if (block.component === 'CompanyIdentity') return <CompanyIdentity/>;
  if (block.component === 'LegalRights') return <LegalRights/>;
  return null;
}
function SalesPage({page}: {page: keyof typeof SALES_PAGES}) {
  const {t, locale} = useLocale();
  const data = SALES_PAGES[page];
  const sections = data.sections.map((section, index) => ({id: section.id, title: section.title,
    content: <>{section.blocks.map((block, i) => <Block key={i} block={block} section={index + 1}/>)}</>}));
  return <LegalPage current={data.path} title={data.title} lede={locale === 'tr' ? undefined : t('Bu metnin bağlayıcı hâli Türkçedir.')} updated={SALES_LEGAL_UPDATED} summary={data.summary} sections={sections}>
    {page === 'kvkk' && <LegalContactBox/>}
  </LegalPage>;
}
export const DistanceSalesContract = () => <SalesPage page="contract"/>;
export const CancellationPolicy = () => <SalesPage page="refund"/>;
export const KvkkNotice = () => <SalesPage page="kvkk"/>;
