"use client";
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import type {PanoramaScene} from '@/lib/panoramas';import {useLocale} from '@/lib/i18n';
export type PanoramaApi={destroy:()=>void;on:(event:string,callback:()=>void)=>PanoramaApi;setYaw:(value:number)=>void;setPitch:(value:number)=>void;setHfov:(value:number)=>void;getYaw:()=>number;getPitch:()=>number;resize:()=>void;addHotSpot:(config:Record<string,unknown>)=>void;removeHotSpot:(id:string)=>void};
declare global{interface Window{pannellum?:{viewer:(element:HTMLElement,config:Record<string,unknown>)=>PanoramaApi}}}
let loading:Promise<void>|undefined;
function loadViewer(){
 if(window.pannellum)return Promise.resolve();
 // The viewer stylesheet is loaded with the script (not @import in CSS) so every bundler accepts it.
 if(!document.querySelector('link[data-pannellum]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/pannellum/pannellum.css';link.dataset.pannellum='';document.head.appendChild(link);}
 if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/pannellum/pannellum.js';const fail=()=>{script.remove();loading=undefined;reject(Error('Görüntüleyici yüklenemedi.'));};script.onload=()=>window.pannellum?resolve():fail();script.onerror=fail;document.head.appendChild(script);});
 return loading;
}
export function PanoramaViewport({scene,scenes,onNavigate,apiRef,crosshair=false,onReady}:{scene:PanoramaScene;scenes:PanoramaScene[];onNavigate:(id:string)=>void;apiRef:MutableRefObject<PanoramaApi|null>;crosshair?:boolean;onReady?:(ready:boolean)=>void}){
 const {t}=useLocale();const canvas=useRef<HTMLDivElement>(null),links=useRef<string[]>([]),navigate=useRef(onNavigate),ready=useRef(onReady),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);navigate.current=onNavigate;ready.current=onReady;
 useEffect(()=>{
  let cancelled=false;setStatus('loading');ready.current?.(false);
  loadViewer().then(()=>{if(cancelled||!canvas.current)return;const view=scene.startView;
   const instance=window.pannellum!.viewer(canvas.current,{type:'equirectangular',panorama:scene.url,autoLoad:true,autoRotate:0,escapeHTML:true,showFullscreenCtrl:false,mouseZoom:'fullscreenonly',yaw:view?.yaw||0,pitch:view?.pitch||0,hfov:100,minHfov:40,maxHfov:120,strings:{loadingLabel:t('360° görüntü yükleniyor…'),noPanoramaError:t('Görüntü bulunamadı.'),fileAccessError:t('Görüntü yüklenemedi.'),genericWebGLError:t('Bu cihazda 360° görüntü açılamıyor.')}});apiRef.current=instance;
   instance.on('load',()=>{if(!cancelled){setStatus('ready');ready.current?.(true);}});instance.on('error',()=>{if(!cancelled){setStatus('error');ready.current?.(false);}});
  }).catch(()=>{if(!cancelled)setStatus('error');});
  return()=>{cancelled=true;apiRef.current?.destroy();apiRef.current=null;links.current=[];ready.current?.(false);};
 // Preserve the camera position while the owner edits links or the starting angle.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[scene.id,scene.url,retry,apiRef]);
 useEffect(()=>{
  const viewer=apiRef.current;if(!viewer||status!=='ready')return;
  links.current.forEach(id=>viewer.removeHotSpot(id));links.current=[];
  for(const link of scene.hotSpots||[]){const target=scenes.find(item=>item.id===link.targetId);if(!target)continue;
   viewer.addHotSpot({id:link.id,pitch:link.pitch,yaw:link.yaw,cssClass:'tour-hotspot',createTooltipFunc:(element:HTMLElement)=>{
    const button=document.createElement('button');button.type='button';button.className='tour-walk-button';button.setAttribute('aria-label',t('{name} odasına geç').replace('{name}',target.name));
    const label=document.createElement('span');label.className='tour-walk-label';label.textContent=target.name;
    const disc=document.createElement('span');disc.className='tour-walk-disc';const arrow=document.createElement('span');arrow.textContent='⌃';disc.appendChild(arrow);button.appendChild(label);button.appendChild(disc);
    button.onclick=event=>{event.preventDefault();event.stopPropagation();navigate.current(target.id);};element.appendChild(button);
   }});links.current.push(link.id);
  }
 },[scene.hotSpots,scenes,status,apiRef,t]);
 useEffect(()=>{if(!canvas.current)return;const observer=new ResizeObserver(()=>apiRef.current?.resize());observer.observe(canvas.current);return()=>observer.disconnect();},[apiRef]);
 return <div className="tour-viewport"><div ref={canvas} className="panorama-canvas" role="region" aria-label={t('{name} 360 derece görüntü; sürükleyerek etrafınıza bakın').replace('{name}',scene.name)} tabIndex={0}/>{status==='ready'&&<span className="tour-current-room">{scene.name}</span>}{crosshair&&status==='ready'&&<div className="tour-crosshair" aria-hidden="true"><i/><span>{t("Geçiş okunun yeri")}</span></div>}{status==='loading'&&<div className="panorama-status" role="status">{t("360° görüntü hazırlanıyor…")}</div>}{status==='error'&&<div className="panorama-status" role="alert"><strong>{t("360° görüntü açılamadı.")}</strong><p>{t("Bağlantınızı veya cihazınızın WebGL desteğini kontrol edin.")}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>{t("Yeniden dene")}</button></div>}</div>;
}
