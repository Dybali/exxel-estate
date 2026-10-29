import {Suspense} from 'react';
import {T} from '@/lib/i18n';
import {AuthForm} from '@/components/AuthForm';
export default function CorporateRegistration(){return <Suspense fallback={<main className="container section"><T id="Yükleniyor…"/></main>}><AuthForm corporate/></Suspense>;}
