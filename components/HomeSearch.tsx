"use client";
import {useState,type FormEvent} from 'react';
import {Search,MapPin,House,Building2,LandPlot,Building,CalendarDays,Hotel,SlidersHorizontal} from 'lucide-react';
import {CITIES,PROPERTY_TYPES} from '@/lib/listings';
import {PROPERTY_CATEGORIES,purposeLabel} from '@/lib/property-categories';
import {AGE_OPTIONS,FLOOR_OPTIONS,ROOM_OPTIONS,SEARCH_CATEGORIES,type SearchFieldKey} from '@/lib/search-categories';
import {LAND_CREDIT,LAND_DEED,LAND_ZONING} from '@/lib/land';
import {useLocale} from '@/lib/i18n';
const icons=[House,Building2,LandPlot,Building,CalendarDays,Hotel];
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
  case 'city':return select(key,'İl',plain(CITIES),'Tüm şehirler');
  case 'rooms':return select(key,'Oda sayısı',plain(ROOM_OPTIONS));
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
