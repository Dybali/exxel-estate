'use client';
import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n';
type Result={fields:Record<string,string>;machine:boolean;revision?:string};
const requests=new Map<string,{until:number;promise:Promise<Result>}>();
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function useContentTranslation(kind:'listing'|'blog',id:string,source:Record<string,string>){
 const {locale}=useLocale(),serialized=JSON.stringify(source),identity=kind+':'+id+':'+locale+':'+serialized;
 const [result,setResult]=useState<{identity:string;value:Result}|null>(null);
 useEffect(()=>{if(locale==='tr')return;let active=true;
  void(async()=>{const revision=await hash(serialized),key=kind+':'+id+':'+locale+':'+revision;let entry=requests.get(key);
   if(!entry||entry.until<Date.now()){
    if(requests.size>300)requests.clear();
    const promise=fetch('/api/translations?'+new URLSearchParams({kind,id,locale}),{signal:AbortSignal.timeout(12000)}).then(async r=>{if(!r.ok)throw Error('translation');const d=await r.json() as Result;return d.revision===revision?d:{fields:{},machine:false};}).catch(()=>({fields:{},machine:false}));entry={until:Date.now()+30000,promise};requests.set(key,entry);
   }
   const value=await entry.promise;if(active)setResult({identity,value});
  })().catch(()=>{});return()=>{active=false;};
 },[kind,id,locale,serialized,identity]);
 return locale!=='tr'&&result?.identity===identity?result.value:{fields:{},machine:false};
}
export function TranslationNotice({machine,hasTranslation}:{machine:boolean;hasTranslation:boolean}){const {locale}=useLocale();if(locale==='tr')return null;const text=machine?{tr:'',en:'Automatically translated with DeepL. Check important details against the original.',de:'Automatisch mit DeepL übersetzt. Wichtige Angaben mit dem Original abgleichen.',fr:'Traduction automatique DeepL. Vérifiez les informations importantes dans l’original.',ar:'ترجمة آلية بواسطة DeepL. راجع التفاصيل المهمة في النص الأصلي.',ru:'Автоматический перевод DeepL. Сверяйте важные сведения с оригиналом.'}[locale]:!hasTranslation?{tr:'',en:'Original text · Translation is not available yet.',de:'Originaltext · Übersetzung noch nicht verfügbar.',fr:'Texte original · Traduction non disponible.',ar:'النص الأصلي · الترجمة غير متاحة بعد.',ru:'Исходный текст · Перевод пока недоступен.'}[locale]:'';return text?<small className="content-translation-notice">{text}</small>:null;}
