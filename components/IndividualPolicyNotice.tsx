"use client";
import {apiJson} from '@/lib/api-client';

import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n';
export function IndividualPolicyNotice(){const {t,locale}=useLocale();const [next,setNext]=useState<string|null>(null);useEffect(()=>{const c=new AbortController();fetch('/api/mine',{signal:c.signal,cache:'no-store'}).then(r=>r.ok?apiJson<{policy?:{nextSubmissionAt?:string|null}}>(r):null).then(d=>{if(d?.policy?.nextSubmissionAt)setNext(d.policy.nextSubmissionAt);}).catch(()=>{});return()=>c.abort();},[]);return <aside className="corporate-hint" role="note"><strong>{t('Bireysel ilan hakkı')}</strong><p>{t('Bireysel üyeler 3 takvim ayında bir ilan verebilir. İlan, yayımlandığı andan itibaren 20 gün yayında kalır. Düzenleme veya silme yeni ilan hakkını erkene almaz.')}</p>{next&&Date.parse(next)>Date.now()&&<p>{t('Sonraki ilan hakkınız')}: <strong>{new Intl.DateTimeFormat(locale,{dateStyle:'long',timeStyle:'short'}).format(new Date(next))}</strong></p>}</aside>;}
