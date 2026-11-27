'use client';
import {Sparkles,X} from 'lucide-react';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from '@/lib/i18n';
import {assistantCopy} from '@/lib/assistant-copy';
import {EstateAssistant} from './EstateAssistant';
export function AssistantLauncher(){
 const path=usePathname(),{locale}=useLocale(),[open,setOpen]=useState(false),[mounted,setMounted]=useState(false),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('assistant')==='1'){setOpen(true);setMounted(true);}},[path]);
 useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[open]);
 if(path?.startsWith('/asistan')||path?.startsWith('/admin')||path?.startsWith('/yonetim')||path?.startsWith('/ilan-ver')||path?.startsWith('/giris')||path?.startsWith('/eposta-dogrula')||path?.startsWith('/sifremi-unuttum'))return null;
 const close=()=>{setOpen(false);button.current?.focus();};
 return <>{mounted&&<aside id="estate-assistant-dock" role="dialog" aria-modal="false" aria-label={assistantCopy[locale].launcher} className="assistant-dock" hidden={!open}><EstateAssistant compact onClose={close}/></aside>}<button ref={button} type="button" className="assistant-launcher" aria-controls="estate-assistant-dock" aria-expanded={open} onClick={()=>{setMounted(true);setOpen(!open);}}>{open?<X size={20}/>:<Sparkles size={20}/>}<span>{assistantCopy[locale].launcher}</span><i/></button></>;
}
