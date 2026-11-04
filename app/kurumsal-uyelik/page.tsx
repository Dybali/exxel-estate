import { ForwardArrow } from "@/components/DirectionalArrow";
import {Suspense} from 'react';
import '../pages.css';
import {T} from '@/lib/i18n';
import Link from '@/components/SafeLink';
import {AuthForm} from '@/components/AuthForm';
export default function CorporateRegistration(){return <><aside className="container bulk-hint"><strong><T id="Emlak ofisi misiniz?"/></strong> <span><T id="Portföyünüzü XML dosyasıyla tek seferde yükleyin."/></span> <Link href="/toplu-ilan"><T id="Toplu ilan yükleme"/><ForwardArrow/></Link></aside><Suspense fallback={<main className="container section"><T id="Yükleniyor…"/></main>}><AuthForm corporate/></Suspense></>;}
