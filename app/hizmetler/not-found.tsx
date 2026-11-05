'use client';
import { Home, Search } from 'lucide-react';
import Link from '@/components/SafeLink';
import { useLocale } from '@/lib/i18n';
import { SERVICE_SEARCH_PATH } from '@/lib/service-search';
import { SERVICE_BASE } from '@/lib/services';

// Unknown category, place or firm under /hizmetler: shown inside the service header and footer.
export default function ServiceNotFound() {
  const { t } = useLocale();
  return <main className="site-state-page"><div className="site-state-mark" aria-hidden="true"><img src="/brand/signet.svg" alt="" width={56} height={56}/><b>404</b></div><span>{t('404 · SAYFA BULUNAMADI')}</span><h1>{t('Aradığınız sayfa şu anda mevcut değil.')}</h1><p>{t('Firma profili kaldırılmış veya bağlantı değişmiş olabilir. Hizmet firmalarında aramaya devam edebilirsiniz.')}</p><div><Link className="primary-button" href={SERVICE_SEARCH_PATH}><Search size={17}/>{t('Firma veya hizmet ara')}</Link><Link className="outline-button" href={SERVICE_BASE}><Home size={17}/>{t('Hizmetler')}</Link></div></main>;
}
