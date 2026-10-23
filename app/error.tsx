'use client';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){const {t}=useLocale();return <main className="site-state-page"><span>{t('GEÇİCİ BİR SORUN OLUŞTU')}</span><h1>{t('Bu sayfayı şu anda açamadık.')}</h1><p>{t('Bağlantınızı kontrol edip tekrar deneyin. Bir işlem gönderdiyseniz yeniden göndermeden önce hesabınızdaki durumunu kontrol edin.')}</p>{error.digest&&/^[a-zA-Z0-9-]{1,64}$/.test(error.digest)&&<small>{t('Hata referansı')}: {error.digest}</small>}<div><button type="button" className="primary-button" onClick={reset}>{t('Tekrar dene')}</button><Link className="outline-button" href="/hesabim">{t('Hesabıma git')}</Link></div></main>;}
