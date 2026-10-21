'use client';
import {Sparkles} from 'lucide-react';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n';
import {assistantCopy} from '@/lib/assistant-copy';
import Link from './SafeLink';
export function AssistantLauncher(){
 const path=usePathname(),{locale}=useLocale(),[sectionVisible,setSectionVisible]=useState(false);
 useEffect(()=>{if(path!=='/'){setSectionVisible(false);return;}const section=document.getElementById('ev-asistani');if(!section||!('IntersectionObserver' in window))return;const observer=new IntersectionObserver(([entry])=>setSectionVisible(entry.isIntersecting));observer.observe(section);return()=>observer.disconnect();},[path]);
 if(sectionVisible||path?.startsWith('/asistan')||path?.startsWith('/admin')||path?.startsWith('/yonetim')||path?.startsWith('/ilan-ver'))return null;
 return <Link className="assistant-launcher" href="/#ev-asistani"><Sparkles size={20}/><span>{assistantCopy[locale].launcher}</span><i/></Link>;
}
