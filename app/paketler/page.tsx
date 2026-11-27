'use client';
import { useLocale } from '@/lib/i18n';
import Link from '@/components/SafeLink';
import { ArrowRight, Building2, Check, HardHat, Home, Sparkles, UserRound, Wrench } from 'lucide-react';
import { CATALOG } from '@/lib/orders';
import { AGENT_PLANS_ENABLED } from '@/lib/publication-policy';
import { INDIVIDUAL_PUBLICATION_DAYS, INDIVIDUAL_SUBMISSION_DAYS } from '@/lib/listing-policy';

// /paketler: the real prices of lib/orders.ts (CATALOG) in Turkish lira, VAT included (owner's decision 2026-11-27,
// needed for the card payment provider application), with links to the sales contract and the refund terms.
// Firm packages have their own pages (/hizmetler/paketler, /muteahhitler/paketler, components/FirmPlans.tsx).
const tl = (amount: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);

export default function Packages() {
  const { t, locale } = useLocale();
  const days = (text: string) => t(text).replace('{publish}', String(INDIVIDUAL_PUBLICATION_DAYS)).replace('{every}', String(INDIVIDUAL_SUBMISSION_DAYS));
  const plans = [
    { name: 'Bireysel ilan', Icon: Home, price: t('Ücretsiz'), period: '', text: 'Kendi gayrimenkulünü yayınlamak isteyenler için.', features: [days('{every} günde 1 ilan hakkı'), days('{publish} gün yayın süresi'), t('Mesaj kutusu')], href: '/ilan-ver', cta: 'İlan ver' },
    { name: 'Profesyonel', Icon: UserRound, price: tl(CATALOG['plan-professional'].amount, locale), period: t('/ 30 gün'), text: 'Portföyünü daha geniş bir kitleye sunmak isteyen danışmanlar için.', features: [t('5 ilan hakkı'), t('30 gün geçerli'), t('Temel istatistikler')], href: '/iletisim', cta: 'Bilgi alın', accent: true },
    { name: 'Prestij', Icon: Building2, price: tl(CATALOG['plan-prestige'].amount, locale), period: t('/ 30 gün'), text: 'Birden fazla gayrimenkulü sunan emlak ofisleri için.', features: [t('20 ilan hakkı'), t('30 gün geçerli'), t('Gelişmiş istatistikler')], href: '/iletisim', cta: 'Bilgi alın' },
  ];
  const boosts = [CATALOG['featured-7'], CATALOG['featured-30']];
  return <main className="pricing-refresh" lang={locale}>
    <section className="editorial-hero pricing-hero"><div className="container">
      <span>{t('PAKETLER VE FİYATLAR')}</span>
      <h1>{t('Paketler ve fiyatlar')}</h1>
      <p>{t('Tüm fiyatlar Türk lirasıdır (TL) ve KDV dahildir.')}</p>
    </div></section>
    <section className="container pricing-content">
      <div className="pricing-plan-grid">{plans.map(({ Icon, ...p }) => <article className={'pricing-plan' + (p.accent ? ' pricing-plan-accent' : '')} key={p.name}>
        <div className="pricing-plan-icon"><Icon size={26}/></div>
        <h2>{t(p.name)}</h2><p>{t(p.text)}</p>
        <div className="pricing-plan-price">{p.price}{p.period && <small>{p.period}</small>}</div>
        {p.period && <small className="pricing-sample-label">{t('KDV dahil')}</small>}
        <Link href={p.href} className="pricing-plan-cta">{t(p.cta)}<ArrowRight size={17}/></Link>
        <div className="pricing-plan-features">{p.features.map((f) => <span key={f}><Check size={17}/>{f}</span>)}</div>
      </article>)}</div>
      {!AGENT_PLANS_ENABLED && <p className="pricing-note">{t('Şu an emlakçılar yetki belgesi onaylandıktan sonra paket almadan da ilan yayımlayabilir.')}</p>}
      <div className="pricing-heading"><h2>{t('İlanınızı öne çıkarın')}</h2><p>{t('Öne çıkan ilanlar aramalarda üst sıralarda ve vurgulu gösterilir.')}</p></div>
      <div className="pricing-boosts">{boosts.map((item) => <div key={item.days}><Sparkles size={20} aria-hidden="true"/><strong>{t(item.label)}</strong><span>{tl(item.amount, locale)} <small>{t('KDV dahil')}</small></span></div>)}</div>
      <div className="pricing-heading"><h2>{t('Firma paketleri')}</h2></div>
      <div className="pricing-boosts">
        <Link href="/hizmetler/paketler"><Wrench size={20} aria-hidden="true"/><strong>{t('Hizmet firması paketleri')}</strong><ArrowRight size={17} aria-hidden="true"/></Link>
        <Link href="/muteahhitler/paketler"><HardHat size={20} aria-hidden="true"/><strong>{t('Müteahhit paketleri')}</strong><ArrowRight size={17} aria-hidden="true"/></Link>
      </div>
      <p className="pricing-note">{t('Satın almadan önce Mesafeli Satış Sözleşmesi ile İptal ve İade Koşulları’nı okuyun.')} <Link href="/mesafeli-satis-sozlesmesi">{t('Mesafeli satış sözleşmesi')}</Link> · <Link href="/iptal-ve-iade-kosullari">{t('İptal ve iade koşulları')}</Link></p>
    </section>
  </main>;
}
