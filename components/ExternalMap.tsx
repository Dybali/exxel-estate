'use client';
import {useState} from 'react';
import {useLocale} from '@/lib/i18n';

export function ExternalMap({src,title}:{src:string;title:string}){
  const {t}=useLocale();
  const [enabled,setEnabled]=useState(false);
  return <div className="property-location-map">
    {enabled?<iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer"/>:<div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:25,textAlign:'center'}}><p style={{maxWidth:420,fontSize:13,lineHeight:1.6,color:'#435a4c',margin:0}}>{t('Haritayı açarsanız OpenStreetMap IP adresinizi ve teknik istek bilgilerini alabilir.')}</p><button type="button" className="outline-button" onClick={()=>setEnabled(true)}>{t('Haritayı yükle')}</button></div>}
  </div>;
}
