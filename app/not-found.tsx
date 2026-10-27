'use client';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
export default function NotFound(){const {t}=useLocale();return <main className="site-state-page"><span>{t('404 · SAYFA BULUNAMADI')}</span><h1>{t('Aradığınız sayfa şu anda mevcut değil.')}</h1><p>{t('İlan kaldırılmış, incelemeye alınmış veya bağlantı değişmiş olabilir. Güncel ilanlardan aramaya devam edebilirsiniz.')}</p><div><Link className="primary-button" href="/ilanlar">{t('İlanları incele')}</Link><Link className="outline-button" href="/">{t('Ana sayfaya dön')}</Link></div></main>;}
