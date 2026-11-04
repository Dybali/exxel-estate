'use client';
import Link from '@/components/SafeLink';
import {Home, Search} from 'lucide-react';
import {useLocale} from '@/lib/i18n';
export default function NotFound(){const {t}=useLocale();return <main className="site-state-page"><div className="site-state-mark" aria-hidden="true"><img src="/brand/signet.svg" alt="" width={56} height={56}/><b>404</b></div><span>{t('404 · SAYFA BULUNAMADI')}</span><h1>{t('Aradığınız sayfa şu anda mevcut değil.')}</h1><p>{t('İlan kaldırılmış, incelemeye alınmış veya bağlantı değişmiş olabilir. Güncel ilanlardan aramaya devam edebilirsiniz.')}</p><div><Link className="primary-button" href="/ilanlar"><Search size={17}/>{t('İlanları incele')}</Link><Link className="outline-button" href="/"><Home size={17}/>{t('Ana sayfaya dön')}</Link></div></main>;}
