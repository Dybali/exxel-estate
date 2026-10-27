"use client";
import {useState,type FormEvent} from 'react';
import {Search,MapPin,House,Building2,LandPlot,Building,CalendarDays,Hotel,SlidersHorizontal} from 'lucide-react';
import {CITIES,PROPERTY_TYPES} from '@/lib/listings';
import {PROPERTY_CATEGORIES,PURPOSES} from '@/lib/property-categories';
import {useLocale} from '@/lib/i18n';
const icons=[House,Building2,LandPlot,Building,CalendarDays,Hotel];
export function HomeSearch(){
 const {t}=useLocale();const [category,setCategory]=useState('konut'),[purpose,setPurpose]=useState('satilik'),[type,setType]=useState(''),[city,setCity]=useState(''),[text,setText]=useState(''),[rooms,setRooms]=useState(''),[extra,setExtra]=useState(false),[minArea,setMinArea]=useState(''),[maxArea,setMaxArea]=useState('');
 const group=PROPERTY_CATEGORIES.find(item=>item.value===category)!;
 function open(map=false){const q=new URLSearchParams({category,purpose});for(const [key,value] of Object.entries({type,city,rooms,minArea,maxArea,q:text.trim()}))if(value)q.set(key,value);if(map)q.set('view','map');window.location.assign(`/ilanlar?${q}`);}
 function submit(event:FormEvent){event.preventDefault();open();}
 return <form className="home-search category-search compact-search" onSubmit={submit} aria-label={t('Gayrimenkul arama')}>
 <div className="category-search-tabs" role="group" aria-label={t('Gayrimenkul kategorileri')}>{PROPERTY_CATEGORIES.map((item,index)=>{const Icon=icons[index];return <button key={item.value} type="button" aria-pressed={category===item.value} className={category===item.value?'active':''} onClick={()=>{setCategory(item.value);setType('');setRooms('');}}><Icon size={19}/><span>{t(item.label)}</span></button>;})}</div>
 <div className="category-search-body"><div className="category-search-grid">
 <label><span>{t('İlan türü')}</span><select value={purpose} onChange={e=>setPurpose(e.target.value)}>{PURPOSES.map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
 <label><span>{t('Gayrimenkul tipi')}</span><select value={type} onChange={e=>setType(e.target.value)}><option value="">{t(category==='konut'?'Konut':'Tümü')}</option>{PROPERTY_TYPES.filter(item=>(group.types as readonly string[]).includes(item.value)).map(item=><option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
 <label><span>{t('İl')}</span><select value={city} onChange={e=>setCity(e.target.value)}><option value="">{t('Tüm şehirler')}</option>{CITIES.map(item=><option key={item}>{item}</option>)}</select></label>
<label><span>{t('Oda düzeni')}</span><select value={rooms} disabled={category==='arsa'} onChange={e=>setRooms(e.target.value)}><option value="">{t('Tümü')}</option>{['1+0','1+1','2+1','3+1','4+1','5+1','6+1'].map(item=><option key={item}>{item}</option>)}</select></label></div><div className="category-search-bottom"><label className="category-text-search"><span>{t('İlan ara')}</span><input type="search" maxLength={160} value={text} onChange={e=>setText(e.target.value)} placeholder={t('İlçe, mahalle veya anahtar kelime')} /></label><button className="category-find" type="submit"><Search size={18}/>{t('Ara')}</button><button className="category-map" type="button" onClick={()=>{const form=document.querySelector<HTMLFormElement>('.category-search');if(form?.reportValidity())open(true);}}><MapPin size={17}/>{t('Haritada ara')}</button></div>
 <div className="category-search-footer"><button type="button" aria-expanded={extra} onClick={()=>setExtra(!extra)}><SlidersHorizontal size={14}/>{t(extra?'Daha az seçenek':'Daha fazla seçenek')}</button><span>{t('Türkiye genelinde gayrimenkul arayın')}</span></div>
 {extra&&<div className="category-extra"><label>{t('Min m²')}<input type="number" min="0" max="999999999999" value={minArea} onChange={e=>setMinArea(e.target.value)}/></label><label>{t('Max m²')}<input type="number" min={minArea||0} max="999999999999" value={maxArea} onChange={e=>setMaxArea(e.target.value)}/></label></div>}
 </div></form>;
}
