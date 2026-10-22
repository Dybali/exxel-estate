import {Suspense} from 'react';
import {AuthForm} from '@/components/AuthForm';
export default function CorporateRegistration(){return <Suspense fallback={<main className="container section">Yükleniyor…</main>}><AuthForm corporate/></Suspense>;}
