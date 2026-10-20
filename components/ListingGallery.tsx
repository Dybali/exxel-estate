"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { ListingActions } from "./ListingActions";
import {PanoramaTour} from './PanoramaTour';
import type {PanoramaScene} from '@/lib/panoramas';
export function ListingGallery({ images, title, listingId,panoramas=[],floorPlan='' }: {images:string[];title:string;listingId?:string;panoramas?:PanoramaScene[];floorPlan?:string}) {
  const [active,setActive]=useState<number|null>(null);const dialog=useRef<HTMLDialogElement>(null);const gallery=images.filter(Boolean);
  useEffect(()=>{const el=dialog.current;if(active===null||!el)return;el.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;};},[active!==null]);
  const go=(direction:number)=>setActive(n=>n===null?0:(n+direction+gallery.length)%gallery.length);
  return <><div className="property-gallery" data-count={Math.min(gallery.length,5)}>
    {gallery.length?gallery.slice(0,5).map((src,index)=><button className={index===0?'property-gallery-main':'property-gallery-tile'} key={`${src}-${index}`} onClick={()=>setActive(index)} aria-label={`${index+1}. fotoğrafı büyüt`}><img src={src} alt={`${title} — fotoğraf ${index+1}`} loading={index===0?'eager':'lazy'}/></button>):<div className="property-gallery-empty"><Building2 size={44}/><span>Bu ilan için fotoğraf eklenmemiş.</span></div>}
    {listingId&&<ListingActions listingId={listingId} title={title} canViewPhotos={gallery.length>0} onGallery={()=>{if(gallery.length)setActive(0);}}/>}
    {gallery.length>0&&<button className="property-gallery-count" aria-label={`${gallery.length} fotoğrafı görüntüle`} onClick={()=>setActive(0)}><Images size={16}/><span>{gallery.length} fotoğrafı görüntüle</span></button>}
    {panoramas.length>0&&<PanoramaTour scenes={panoramas} floorPlan={floorPlan} compact/>}
  </div>
  {active!==null&&gallery.length>0&&<dialog ref={dialog} className="property-lightbox" onCancel={()=>setActive(null)} onClick={e=>{if(e.target===e.currentTarget)setActive(null);}} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();go(1);}if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}} aria-label="İlan fotoğrafları"><div className="property-lightbox-toolbar"><span>{active+1} / {gallery.length}</span><button autoFocus onClick={()=>setActive(null)} aria-label="Galeriyi kapat"><X size={25}/></button></div><div className="property-lightbox-image"><button disabled={gallery.length===1} onClick={()=>go(-1)} aria-label="Önceki fotoğraf"><ChevronLeft size={28}/></button><img src={gallery[active]} alt={`${title} — fotoğraf ${active+1}`}/><button disabled={gallery.length===1} onClick={()=>go(1)} aria-label="Sonraki fotoğraf"><ChevronRight size={28}/></button></div><p>{title}</p></dialog>}
  </>;
}

