"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {Search,MapPin,House,Building2,LandPlot,Building,CalendarDays,Hotel,SlidersHorizontal,ChevronDown,Check} from 'lucide-react';
import {CITIES,PROPERTY_TYPES} from '@/lib/listings';
import {PROPERTY_CATEGORIES,purposeLabel} from '@/lib/property-categories';
import {AGE_OPTIONS,FLOOR_OPTIONS,ROOM_OPTIONS,SEARCH_CATEGORIES,type SearchFieldKey} from '@/lib/search-categories';
import {LAND_CREDIT,LAND_DEED,LAND_ZONING} from '@/lib/land';
import {subtypeFor} from '@/lib/property-subtypes';
import {useLocale} from '@/lib/i18n';
const icons=[House,Building2,LandPlot,Building,CalendarDays,Hotel];
// Room count accepts several values ("1+1,2+1"), like the sidebar on /ilanlar (lib/search-categories.ts reads the list).
// The search box clips its content (rounded corners), so the panel is placed with position:fixed under the button
// and follows it when the page scrolls or resizes. It is rendered into <body> so no card or section below the
// search box can cover it (2026-11-25: it slipped under the Emlak piyasası card).
function RoomsPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const {t}=useLocale();const [open,setOpen]=useState(false),[place,setPlace]=useState<{top:number;left:number;width:number}|null>(null);
 const button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const chosen=value?value.split(","):[];
 const label=(v:string)=>v==="1+0"?`${t("Stüdyo")} (1+0)`:t(v);
 const summary=!chosen.length?t("Tümü"):chosen.length<=2?chosen.map(label).join(", "):`${chosen.slice(0,2).map(label).join(", ")} +${chosen.length-2}`;
 const toggle=(v:string)=>onChange((chosen.includes(v)?chosen.filter(item=>item!==v):[...chosen,v]).sort((a,b)=>ROOM_OPTIONS.indexOf(a as never)-ROOM_OPTIONS.indexOf(b as never)).join(","));
 function measure(){const r=button.current?.getBoundingClientRect();if(!r)return;const width=Math.min(Math.max(r.width,300),window.innerWidth-24);setPlace({top:r.bottom+6,left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),width});}
 function show(){measure();setOpen(true);}
 useEffect(()=>{if(!open)return;
  const away=(event:Event)=>{const target=event.target as Node;if(!panel.current?.contains(target)&&!button.current?.contains(target))setOpen(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);button.current?.focus();}};
  const follow=()=>measure();
  document.addEventListener("pointerdown",away);document.addEventListener("keydown",key);window.addEventListener("resize",follow);window.addEventListener("scroll",follow,true);
  return ()=>{document.removeEventListener("pointerdown",away);document.removeEventListener("keydown",key);window.removeEventListener("resize",follow);window.removeEventListener("scroll",follow,true);};
 },[open]);
 return <div className="rooms-picker"><span id="rooms-picker-label">{t("Oda sayısı")}</span>
  <button ref={button} type="button" className={`rooms-picker-button${chosen.length?" chosen":""}`} aria-haspopup="true" aria-expanded={open} aria-labelledby="rooms-picker-label rooms-picker-value" onClick={()=>open?setOpen(false):show()}><span id="rooms-picker-value">{summary}</span><ChevronDown size={16} aria-hidden="true"/></button>
  {open&&place&&createPortal(<div ref={panel} className="rooms-picker-panel" role="group" aria-label={t("Oda sayısı")} style={{top:place.top,left:place.left,width:place.width}}>
   <p>{t("Birden fazla seçebilirsiniz")}</p>
   <div className="rooms-picker-options">{ROOM_OPTIONS.map(v=><label key={v} className={chosen.includes(v)?"on":""}><input type="checkbox" checked={chosen.includes(v)} onChange={()=>toggle(v)}/>{chosen.includes(v)&&<Check size={13} aria-hidden="true"/>}{label(v)}</label>)}</div>
   <div className="rooms-picker-actions"><button type="button" onClick={()=>onChange("")} disabled={!chosen.length}>{t("Temizle")}</button><button type="button" className="done" onClick={()=>{setOpen(false);button.current?.focus();}}>{t("Tamam")}</button></div>
  </div>,document.body)}
 </div>;
}
type Values=Partial<Record<SearchFieldKey,string>>;
export function HomeSearch(){
 const {t}=useLocale();const [category,setCategory]=useState('konut'),[purpose,setPurpose]=useState('satilik'),[values,setValues]=useState<Values>({}),[text,setText]=useState(''),[extra,setExtra]=useState(false);
 const group=PROPERTY_CATEGORIES.find(item=>item.value===category)!,fields=SEARCH_CATEGORIES[category];
 const set=(key:SearchFieldKey,value:string)=>setValues(old=>({...old,[key]:value}));
 function choose(value:string){setCategory(value);setValues(old=>({city:old.city}));const purposes=SEARCH_CATEGORIES[value].purposes;if(!purposes.includes(purpose))setPurpose(purposes[0]);}
 function open(map=false){const q=new URLSearchParams({category,purpose});for(const key of [...fields.main,...fields.extra]){const value=values[key];if(value)q.set(key,value);}if(text.trim())q.set('q',text.trim());if(map)q.set('view','map');window.location.assign(`/ilanlar?${q}`);}
 function submit(event:FormEvent){event.preventDefault();open();}
 const select=(key:SearchFieldKey,label:string,options:readonly {value:string;label:string}[],any='Tümü')=><label key={key}><span>{t(label)}</span><select value={values[key]||''} onChange={e=>set(key,e.target.value)}><option value="">{t(any)}</option>{options.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
 const number=(key:SearchFieldKey,label:string,placeholder:string)=><label key={key}><span>{t(label)}</span><input type="number" min="0" max="999999999999" inputMode="numeric" placeholder={placeholder} value={values[key]||''} onChange={e=>set(key,e.target.value)}/></label>;
 const plain=(items:readonly string[],format=(v:string)=>v)=>items.map(value=>({value,label:format(value)}));
 function field(key:SearchFieldKey){switch(key){
  case 'type':return select(key,'Konut tipi',PROPERTY_TYPES.filter(item=>(group.types as readonly string[]).includes(item.value)).map(item=>({value:item.value,label:t(item.label)})));
  case 'businessType':case 'tourismType':{const subtype=subtypeFor(key);return select(key,subtype.label,plain(subtype.options,t));}
  case 'city':return select(key,'İl',plain(CITIES),'Tüm şehirler');
  case 'rooms':return <RoomsPicker key={key} value={values.rooms||''} onChange={value=>set(key,value)}/>;
  case 'minArea':return number(key,'Min m²','m²');
  case 'maxArea':return number(key,'Max m²','m²');
  case 'minPrice':return number(key,'En az fiyat (TL)','Min');
  case 'maxPrice':return number(key,'En çok fiyat (TL)','Max');
  case 'maxAge':return select(key,'Bina yaşı',plain(AGE_OPTIONS,v=>v==='0'?t('Sıfır bina'):`${t('En çok')} ${v}`),'Fark etmez');
  case 'minFloors':return select(key,'Kat sayısı',plain(FLOOR_OPTIONS,v=>`${t('En az')} ${v}`),'Fark etmez');
  case 'zoning':return select(key,'İmar Durumu',plain(LAND_ZONING,t));
  case 'deed':return select(key,'Tapu Durumu',plain(LAND_DEED.filter(v=>v!=='Belirtilmemiş'),t));
  case 'credit':return select(key,'Krediye Uygunluk',plain(LAND_CREDIT,t),'Fark etmez');
  case 'furnished':return <label key={key} className="category-check"><input type="checkbox" checked={values.furnished==='1'} onChange={e=>set(key,e.target.checked?'1':'')}/><span>{t('Eşyalı')}</span></label>;
 }}
 return <form className="home-search category-search compact-search" onSubmit={submit} aria-label={t('Gayrimenkul arama')}>
 <div className="category-search-tabs" role="group" aria-label={t('Gayrimenkul kategorileri')}>{PROPERTY_CATEGORIES.map((item,index)=>{const Icon=icons[index];return <button key={item.value} type="button" aria-pressed={category===item.value} className={category===item.value?'active':''} onClick={()=>choose(item.value)}><Icon size={19}/><span>{t(item.label)}</span></button>;})}</div>
 <div className="category-search-body"><div className="category-search-grid">
 <label><span>{t('İlan türü')}</span><select value={purpose} disabled={fields.purposes.length<2} onChange={e=>setPurpose(e.target.value)}>{fields.purposes.map(value=><option key={value} value={value}>{t(purposeLabel(value))}</option>)}</select></label>
 {fields.main.map(field)}</div><div className="category-search-bottom"><label className="category-text-search"><span>{t('İlan ara')}</span><input type="search" maxLength={160} value={text} onChange={e=>setText(e.target.value)} placeholder={t('İlçe, mahalle veya anahtar kelime')} /></label><button className="category-find" type="submit"><Search size={18}/>{t('Ara')}</button><button className="category-map" type="button" onClick={()=>{const form=document.querySelector<HTMLFormElement>('.category-search');if(form?.reportValidity())open(true);}}><MapPin size={17}/>{t('Haritada ara')}</button></div>
 <div className="category-search-footer"><button type="button" aria-expanded={extra} onClick={()=>setExtra(!extra)}><SlidersHorizontal size={14}/>{t(extra?'Daha az seçenek':'Daha fazla seçenek')}</button><span>{t('Türkiye genelinde gayrimenkul arayın')}</span></div>
 {extra&&<div className="category-extra">{fields.extra.map(field)}</div>}
 </div></form>;
}
