'use client';
import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n';
type Result={fields:Record<string,string>;machine:boolean;revision?:string;status?:string};
const requests=new Map<string,{until:number;promise:Promise<Result>}>();
let preparing=0;const waiting:(()=>void)[]=[];
async function preparationSlot<T>(run:()=>Promise<T>){if(preparing>=2)await new Promise<void>(resolve=>waiting.push(resolve));else preparing++;try{return await run();}finally{const next=waiting.shift();if(next)next();else preparing--;}}
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
// `sourceLanguage` is the language the text is written in (Turkish unless a listing says otherwise,
// lib/listing-language.ts); readers in that language get the original and no request is made.
// `initial`: a saved translation the server already rendered (lib/translation-stored.ts); shown from the first
// paint and not requested again. Without it (nothing saved yet) the browser asks /api/translations as before.
export function useContentTranslation(kind:'listing'|'blog',id:string,source:Record<string,string>,sourceLanguage:string='tr',initial?:{locale:string;fields:Record<string,string>;machine:boolean}|null){
 const {locale}=useLocale(),serialized=JSON.stringify(source),identity=kind+':'+id+':'+locale+':'+serialized;
 const seeded=initial&&initial.locale===locale&&locale!==sourceLanguage?initial:null,hasSeed=Boolean(seeded);
 const [result,setResult]=useState<{identity:string;value:Result}|null>(null);
 useEffect(()=>{if(locale===sourceLanguage||hasSeed)return;let active=true;
  void(async()=>{const revision=await hash(serialized),key=kind+':'+id+':'+locale+':'+revision;let entry=requests.get(key);
   if(!entry||entry.until<Date.now()){
    if(requests.size>300)requests.clear();
    const promise=(async()=>{
     const url='/api/translations?'+new URLSearchParams({kind,id,locale});
     const read=async()=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('translation');return await r.json() as Result;};
     let d=await read();
     if(d.status!=='ready'){
      const r=await preparationSlot(()=>fetch('/api/translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,locale}),signal:AbortSignal.timeout(25000)}));
      if(!r.ok)throw Error('translation');d=await r.json() as Result;
      for(const delay of [1000,2000,4000,6000]){if(d.status!=='pending')break;await new Promise(resolve=>setTimeout(resolve,delay));d=await read();if(d.status!=='ready')d={...d,status:'pending'};}
     }
     return d.revision===revision?d:{fields:{},machine:false};
    })().catch(()=>({fields:{},machine:false}));entry={until:Date.now()+30000,promise};requests.set(key,entry);
   }
   const value=await entry.promise;if(active)setResult({identity,value});
  })().catch(()=>{});return()=>{active=false;};
 },[kind,id,locale,serialized,identity,sourceLanguage,hasSeed]);
 if(seeded)return {fields:seeded.fields,machine:seeded.machine};
 return locale!==sourceLanguage&&result?.identity===identity?result.value:{fields:{},machine:false};
}
export function TranslationNotice({machine,hasTranslation,sourceLanguage='tr'}:{machine:boolean;hasTranslation:boolean;sourceLanguage?:string}){const {locale}=useLocale();if(locale===sourceLanguage)return null;const text=machine?{tr:'Yapay zekâ ile otomatik çevrildi. Önemli ayrıntıları asıl metinle karşılaştırın.',en:'Automatically translated by AI. Check important details against the original.',de:'Automatisch per KI übersetzt. Wichtige Angaben mit dem Original abgleichen.',fr:'Traduction automatique par IA. Vérifiez les informations importantes dans l’original.',ar:'ترجمة آلية بالذكاء الاصطناعي. راجع التفاصيل المهمة في النص الأصلي.',fa:'ترجمهٔ خودکار با هوش مصنوعی. جزئیات مهم را با متن اصلی مقایسه کنید.',ru:'Автоматический перевод с помощью ИИ. Сверяйте важные сведения с оригиналом.',nl:'Automatisch vertaald met AI. Controleer belangrijke gegevens aan de hand van het origineel.', es: "Traducido automáticamente por IA. Compruebe los detalles importantes con el original.", it: "Tradotto automaticamente dall’IA. Verifica i dettagli importanti confrontandoli con l’originale."}[locale]:!hasTranslation?{tr:'Asıl metin · Çeviri henüz hazır değil.',en:'Original text · Translation is not available yet.',de:'Originaltext · Übersetzung noch nicht verfügbar.',fr:'Texte original · Traduction non disponible.',ar:'النص الأصلي · الترجمة غير متاحة بعد.',fa:'متن اصلی · ترجمه هنوز در دسترس نیست.',ru:'Исходный текст · Перевод пока недоступен.',nl:'Originele tekst · Vertaling is nog niet beschikbaar.', es: "Texto original · La traducción aún no está disponible.", it: "Testo originale · Traduzione non ancora disponibile."}[locale]:'';return text?<small className="content-translation-notice">{text}</small>:null;}
