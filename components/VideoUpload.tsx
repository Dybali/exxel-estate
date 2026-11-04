"use client";
import {useEffect,useRef,useState} from "react";
import {Film,RotateCw,Trash2,UploadCloud,X} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {MAX_VIDEO_BYTES,MAX_VIDEO_SECONDS,validVideoId,type VideoStatus} from "@/lib/listing-video";
import {ListingVideoPlayer} from "./ListingVideoPlayer";

type Status={status:VideoStatus|"missing";error?:string|null;width?:number|null;height?:number|null};
type Start={id?:string;chunkSize?:number;parts?:number;error?:string};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const VIDEO_FILE=/\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i;
class UploadStop extends Error{constructor(message:string,public final=false){super(message);}}

// Sends one chunk with upload progress. Network errors and 5xx can be retried; 4xx cannot.
function sendPart(id:string,part:number,chunk:Blob,onProgress:(sent:number)=>void,xhrRef:{current:XMLHttpRequest|null}){
 return new Promise<void>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhrRef.current=xhr;
  xhr.open("PUT",`/api/video-upload?id=${id}&part=${part}`);xhr.setRequestHeader("Content-Type","application/octet-stream");
  xhr.upload.onprogress=e=>onProgress(e.loaded);
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300)return resolve();let message="";try{message=JSON.parse(xhr.responseText).error||"";}catch{}reject(new UploadStop(message||"Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",xhr.status>=400&&xhr.status<500&&xhr.status!==408&&xhr.status!==429));};
  xhr.onerror=()=>reject(new UploadStop("network"));xhr.onabort=()=>reject(new UploadStop("aborted",true));
  xhr.send(chunk);
 });
}
function videoDuration(file:File){return new Promise<number|null>(resolve=>{const video=document.createElement("video"),src=URL.createObjectURL(file);let settled=false;const done=(value:number|null)=>{if(settled)return;settled=true;URL.revokeObjectURL(src);resolve(value);};video.preload="metadata";video.onloadedmetadata=()=>done(Number.isFinite(video.duration)?video.duration:null);video.onerror=()=>done(null);setTimeout(()=>done(null),8000);video.src=src;});}

// Listing video upload to our own server (docs/listing-videos.md): chunked and resumable, with
// progress and cancel; then the processing status (uploading / processing / ready / failed) by polling.
export function VideoUpload({value,onChange,onBusyChange}:{value?:string;onChange:(id:string)=>void;onBusyChange?:(busy:boolean)=>void}){
 const {t}=useLocale();
 const [progress,setProgress]=useState<number|null>(null),[error,setError]=useState(""),[status,setStatus]=useState<Status|null>(null),[paused,setPaused]=useState(false);
 const xhr=useRef<XMLHttpRequest|null>(null),cancelled=useRef(false),pending=useRef<{id:string;file:File;chunk:number;parts:number}|null>(null);
 const id=validVideoId(value)?value:"";
 // Poll until the server finished processing the video.
 useEffect(()=>{if(!id){setStatus(null);return;}let active=true;
  (async()=>{for(let i=0;i<720&&active;i++){try{const r=await fetch(`/api/video-upload?id=${id}`,{cache:"no-store"});if(r.status===404){if(active)setStatus({status:"missing"});return;}if(r.ok){const s=await apiJson<Status>(r);if(!active)return;setStatus(s);if(s.status==="ready"||s.status==="failed")return;}}catch{}await wait(i<30?4000:15000);}})();
  return()=>{active=false;};},[id]);

 async function uploadParts(){
  const job=pending.current;if(!job)return;
  setPaused(false);setError("");setProgress(value=>value??0);cancelled.current=false;onBusyChange?.(true);
  try{
   // Parts already stored (after a network error or a paused upload) are skipped.
   const done=new Set<number>();
   try{const r=await fetch(`/api/video-upload?id=${job.id}&parts=1`,{cache:"no-store"});if(r.ok)for(const part of (await apiJson<{parts?:number[]}>(r)).parts||[])done.add(part);}catch{}
   for(let round=0;round<3;round++){
    for(let part=1;part<=job.parts;part++){
     if(done.has(part))continue;
     const start=(part-1)*job.chunk,chunk=job.file.slice(start,Math.min(job.file.size,start+job.chunk));
     for(let attempt=1;;attempt++){
      try{await sendPart(job.id,part,chunk,sent=>setProgress((start+sent)/job.file.size),xhr);done.add(part);setProgress(Math.min(1,(start+chunk.size)/job.file.size));break;}
      catch(cause){const stop=cause as UploadStop;if(cancelled.current||stop.final)throw stop;if(attempt>=5)throw new UploadStop("paused");await wait(Math.min(30000,1500*2**attempt));}
     }
    }
    const finish=await fetch("/api/video-upload",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:job.id,action:"complete"})});
    const result=await apiJson<{status?:VideoStatus;missing?:number[];error?:string}>(finish);
    if(finish.ok){pending.current=null;setStatus({status:result.status||"queued"});onChange(job.id);return;}
    if(finish.status!==409||!result.missing?.length)throw new UploadStop(result.error||"Video kaydedilemedi. Tekrar deneyin.",true);
    for(const part of result.missing)done.delete(part);
   }
   throw new UploadStop("Video kaydedilemedi. Tekrar deneyin.",true);
  }catch(cause){
   const stop=cause as UploadStop;
   if(cancelled.current)return;
   if(stop.message==="paused"||stop.message==="network"){setPaused(true);setError("Yükleme durdu. Bağlantınız düzelince kaldığı yerden devam edebilirsiniz.");}
   else{setError(stop.message);await discard();}
  }finally{xhr.current=null;setProgress(null);onBusyChange?.(false);}
 }
 async function discard(){const job=pending.current;pending.current=null;setPaused(false);if(job)await fetch(`/api/video-upload?id=${job.id}`,{method:"DELETE"}).catch(()=>null);}
 async function upload(file:File){
  setError("");
  if(!file.type.startsWith("video/")&&!VIDEO_FILE.test(file.name))return setError("Lütfen bir video dosyası seçin.");
  if(file.size>MAX_VIDEO_BYTES)return setError("Video en fazla 1 GB olabilir.");
  const duration=await videoDuration(file);
  if(duration&&duration>MAX_VIDEO_SECONDS+1)return setError("Video en fazla 3 dakika olabilir. Daha kısa bir video yükleyin.");
  await discard();
  setProgress(0);onBusyChange?.(true);
  try{
   const start=await fetch("/api/video-upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({size:file.size,type:file.type})}),data=await apiJson<Start>(start);
   if(!start.ok||!validVideoId(data.id)||!data.chunkSize||!data.parts)throw Error(data.error||"Video yüklemesi başlatılamadı. Tekrar deneyin.");
   pending.current={id:data.id,file,chunk:data.chunkSize,parts:data.parts};
  }catch(cause){setProgress(null);onBusyChange?.(false);return setError((cause as Error).message||"Video yüklemesi başlatılamadı. Tekrar deneyin.");}
  await uploadParts();
 }
 async function cancel(){cancelled.current=true;xhr.current?.abort();setProgress(null);setError("");await discard();}
 // Removing an attached video only clears the field; the listing save deletes it. An upload that
 // was never attached is deleted at once (the server refuses for attached ones).
 function remove(){const current=id;onChange("");setStatus(null);if(current)void fetch(`/api/video-upload?id=${current}`,{method:"DELETE"}).catch(()=>null);}

 const state=status?.status;
 return <section className="presentation-fields video-upload"><h2>{t("İlan videosu")}</h2><p>{t("Telefonunuzla çektiğiniz videoyu yükleyin: en fazla 3 dakika ve 1 GB. Video her cihazda akıcı oynaması için otomatik hazırlanır.")}</p>
  {progress!=null?<div className="video-upload-progress" role="status"><div><Film size={18}/><strong>{t("Video yükleniyor")} · %{Math.floor(progress*100)}</strong><button type="button" className="outline-button" onClick={()=>void cancel()}><X size={15}/>{t("İptal")}</button></div><progress max={1} value={progress}/></div>
  :paused?<div className="video-upload-progress" role="status"><div><Film size={18}/><strong>{t("Video yükleniyor")}</strong><button type="button" className="outline-button" onClick={()=>void uploadParts()}><RotateCw size={15}/>{t("Devam et")}</button><button type="button" className="outline-button" onClick={()=>void cancel()}><X size={15}/>{t("İptal")}</button></div></div>
  :id?<div className="video-upload-preview">
    {state==="ready"?<><p className="video-upload-ready" role="status">{t("Video hazır")}</p><ListingVideoPlayer key={id} id={id} width={status?.width} height={status?.height} heading={false}/></>
    :state==="failed"?<p className="form-error" role="alert">{t(status?.error||"Video işlenemedi. Başka bir video yükleyin.")}</p>
    :state==="missing"?<p className="form-error" role="alert">{t("Video bulunamadı. Videoyu yeniden yükleyin.")}</p>
    :<p className="video-upload-processing" role="status"><span className="spinner" aria-hidden="true"/><span><strong>{t("Video işleniyor")}</strong> · {t("İlanınızı şimdi kaydedebilirsiniz; video hazır olunca ilanda görünür.")}</span></p>}
    <div className="video-upload-actions"><button type="button" className="outline-button danger" onClick={remove}><Trash2 size={15}/>{t("Videoyu kaldır")}</button><label className="outline-button video-upload-replace"><UploadCloud size={15}/>{t("Videoyu değiştir")}<input type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file){remove();void upload(file);}}}/></label></div>
   </div>
  :<label className="video-upload-drop"><UploadCloud size={26}/><strong>{t("Video seçin")}</strong><small>MP4, MOV, WEBM · {t("en fazla 3 dakika")}</small><input type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void upload(file);}}/></label>}
  {error&&<p className="form-error" role="alert">{t(error)}</p>}
 </section>;
}
