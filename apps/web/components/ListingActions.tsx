"use client";
import {CompareButton} from "./Compare";
import { useEffect, useRef, useState } from "react";
import { Heart, Share2, MoreHorizontal, Copy, Images, Check, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { favoritesChanged } from "@/lib/favorites-client";
export function ListingActions({listingId,title,onGallery,canViewPhotos=true}:{listingId:string;title:string;onGallery:()=>void;canViewPhotos?:boolean}) {
  const {t}=useLocale();const [saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[menu,setMenu]=useState(false),[notice,setNotice]=useState(""),[copyUrl,setCopyUrl]=useState("");const box=useRef<HTMLDivElement>(null);
  useEffect(()=>{const c=new AbortController();fetch('/api/favorites',{signal:c.signal,cache:'no-store'}).then(async r=>r.ok?await r.json() as {ids?:string[]}:{ids:[]}).then(d=>{if(!c.signal.aborted)setSaved((d.ids||[]).includes(listingId));}).catch(()=>{});return()=>c.abort();},[listingId]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),4000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{const outside=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setMenu(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);setCopyUrl("");}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[]);
  async function toggle(){if(busy)return;setBusy(true);try{const r=await fetch(saved?`/api/favorites?id=${encodeURIComponent(listingId)}`:'/api/favorites',{method:saved?'DELETE':'POST',headers:saved?undefined:{'Content-Type':'application/json'},body:saved?undefined:JSON.stringify({id:listingId})});if(r.status===401){location.assign(`/giris?next=${encodeURIComponent(`/ilan/${listingId}`)}`);return;}if(!r.ok)throw Error('Favori güncellenemedi.');setSaved(!saved);favoritesChanged();setNotice(saved?'Favorilerden kaldırıldı.':'Favorilerinize eklendi.');}catch(e){setNotice(e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}}
  async function copy(value=location.href){setMenu(false);try{await navigator.clipboard.writeText(value);setNotice('Kopyalandı.');}catch{setCopyUrl(value);}}
  async function share(){if(navigator.share){try{await navigator.share({title,url:location.href});return;}catch(e){if(e instanceof Error&&e.name==='AbortError')return;}}await copy();}
  return <div className="listing-actions" ref={box}>
    <button aria-label={t(saved?'Favorilerden kaldır':'Favorilere ekle')} aria-pressed={saved} disabled={busy} className={saved?'saved':''} onClick={toggle}><Heart size={20} fill={saved?'currentColor':'none'}/></button>
    <CompareButton id={listingId}/><button aria-label={t('İlanı paylaş')} onClick={share}><Share2 size={19}/></button><button aria-label={t('Diğer ilan işlemleri')} aria-expanded={menu} onClick={()=>setMenu(!menu)}><MoreHorizontal size={22}/></button>
    {menu&&<div className="listing-actions-menu"><button disabled={!canViewPhotos} onClick={()=>{setMenu(false);onGallery();}}><Images size={16}/> Fotoğrafları görüntüle</button><button onClick={()=>copy()}><Copy size={16}/> Bağlantıyı kopyala</button><button onClick={()=>copy(listingId)}><Copy size={16}/> İlan numarasını kopyala</button></div>}
    {notice&&<div className="listing-action-notice" role="status"><Check size={14}/>{notice}</div>}
    {copyUrl&&<div className="listing-copy-box"><button aria-label="Kopyalama alanını kapat" onClick={()=>setCopyUrl("")}><X size={16}/></button><label>Seçip kopyalayın<input value={copyUrl} readOnly autoFocus onFocus={e=>e.currentTarget.select()}/></label></div>}
  </div>;
}

