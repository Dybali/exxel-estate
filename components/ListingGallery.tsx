"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Flag, Images, PlayCircle, X } from "lucide-react";
import {ListingVideoPlayer} from './ListingVideoPlayer';
import {ReportListing} from './ReportListing';
import { ListingActions } from "./ListingActions";
import {PanoramaTour} from './PanoramaTour';
import {useLocale} from '@/lib/i18n';
import type {PanoramaScene} from '@/lib/panoramas';
export function ListingGallery({ images, title, listingId,panoramas=[],floorPlan='',video=null }: {images:string[];title:string;listingId?:string;panoramas?:PanoramaScene[];floorPlan?:string;video?:{id:string;width:number;height:number}|null}) {
  const {t}=useLocale();const [active,setActive]=useState<number|null>(null),[reportOpen,setReportOpen]=useState(false);const reportButton=useRef<HTMLButtonElement>(null);const [slide,setSlide]=useState(0);const dialog=useRef<HTMLDialogElement>(null),videoDialog=useRef<HTMLDialogElement>(null),[videoOpen,setVideoOpen]=useState(false);const gallery=images.filter(Boolean);
  useEffect(()=>{const el=dialog.current;if(active===null||!el)return;el.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;};},[active!==null]);
  useEffect(()=>{const el=videoDialog.current;if(!videoOpen||!el)return;el.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;};},[videoOpen]);
  const go=(direction:number)=>setActive(n=>n===null?0:(n+direction+gallery.length)%gallery.length);
  return <><div className="property-gallery" data-count={Math.min(gallery.length,5)}>
    {gallery.length?gallery.slice(0,5).map((src,index)=><button className={index===0?'property-gallery-main':'property-gallery-tile'} key={`${src}-${index}`} onClick={()=>setActive(index)} aria-label={t('{n}. fotoğrafı büyüt').replace('{n}',String(index+1))}><img src={src} alt={`${title} — ${t('fotoğraf')} ${index+1}`} loading={index===0?'eager':'lazy'}/></button>):<div className="property-gallery-empty"><Building2 size={44}/><span>{t('Bu ilan için fotoğraf eklenmemiş.')}</span></div>}
    {/* Phones: one full-width photo at a time, swiped sideways (app/polish.css); the grid above is for wider screens. */}
    {gallery.length>0&&<div className="property-gallery-swipe" onScroll={e=>{const el=e.currentTarget;if(el.clientWidth)setSlide(Math.min(gallery.length-1,Math.round(Math.abs(el.scrollLeft)/el.clientWidth)));}}>
     {gallery.map((src,index)=><button key={`${src}-${index}`} onClick={()=>setActive(index)} aria-label={t('{n}. fotoğrafı büyüt').replace('{n}',String(index+1))}><img src={src} alt={`${title} — ${t('fotoğraf')} ${index+1}`} loading={index===0?'eager':'lazy'}/></button>)}
    </div>}
    {gallery.length>1&&<span className="property-gallery-position" aria-hidden="true">{slide+1} / {gallery.length}</span>}
    {listingId&&<ListingActions listingId={listingId} title={title} canViewPhotos={gallery.length>0} onGallery={()=>{if(gallery.length)setActive(0);}}/>}
    {(gallery.length>0||video)&&<div className="property-gallery-buttons">
     {video&&<button type="button" className="property-gallery-count property-gallery-video" onClick={()=>setVideoOpen(true)}><PlayCircle size={16}/><span>{t('Videoyu izle')}</span></button>}
     {gallery.length>0&&<button className="property-gallery-count" aria-label={t('{n} fotoğrafı görüntüle').replace('{n}',String(gallery.length))} onClick={()=>setActive(0)}><Images size={16}/><span>{t('{n} fotoğrafı görüntüle').replace('{n}',String(gallery.length))}</span></button>}
    </div>}
    {panoramas.length>0&&<PanoramaTour scenes={panoramas} floorPlan={floorPlan} compact/>}
  </div>
  {listingId&&<div className="listing-report-bar"><span>{t('Hatalı veya şüpheli bir ilan mı?')}</span><button ref={reportButton} type="button" onClick={()=>setReportOpen(true)}><Flag className="listing-report-icon" size={16} aria-hidden="true"/> {t('İlanı bildir')}</button></div>}
  {listingId&&reportOpen&&<ReportListing listingId={listingId} title={title} onClose={()=>{setReportOpen(false);requestAnimationFrame(()=>reportButton.current?.focus());}}/>}
  {videoOpen&&video&&<dialog ref={videoDialog} className="property-lightbox property-video-lightbox" onCancel={()=>setVideoOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setVideoOpen(false);}} aria-label={t('İlan videosu')}><div className="property-lightbox-toolbar"><span>{t('İlan videosu')}</span><button autoFocus onClick={()=>setVideoOpen(false)} aria-label={t('Videoyu kapat')}><X size={25}/></button></div><div className="property-video-lightbox-body"><ListingVideoPlayer id={video.id} width={video.width} height={video.height} heading={false} autoPlay/></div><p>{title}</p></dialog>}
  {active!==null&&gallery.length>0&&<dialog ref={dialog} className="property-lightbox" onCancel={()=>setActive(null)} onClick={e=>{if(e.target===e.currentTarget)setActive(null);}} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();go(1);}if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}} aria-label={t('İlan fotoğrafları')}><div className="property-lightbox-toolbar"><span>{active+1} / {gallery.length}</span><button autoFocus onClick={()=>setActive(null)} aria-label={t('Galeriyi kapat')}><X size={25}/></button></div><div className="property-lightbox-image"><button disabled={gallery.length===1} onClick={()=>go(-1)} aria-label={t('Önceki fotoğraf')}><ChevronLeft size={28}/></button><img src={gallery[active]} alt={`${title} — ${t('fotoğraf')} ${active+1}`}/><button disabled={gallery.length===1} onClick={()=>go(1)} aria-label={t('Sonraki fotoğraf')}><ChevronRight size={28}/></button></div><p>{title}</p></dialog>}
  </>;
}

