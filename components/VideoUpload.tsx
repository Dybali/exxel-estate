"use client";
import {useEffect,useRef,useState} from "react";
import {Film,Trash2,UploadCloud,X} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {MAX_VIDEO_BYTES,MAX_VIDEO_SECONDS,TUS_CHUNK_BYTES,streamEmbed,validStreamUid} from "@/lib/stream-video";

type Status={ready:boolean;failed:boolean};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

// Sends one tus chunk with upload progress; resolves with the server's new offset.
function sendChunk(url:string,offset:number,chunk:Blob,onProgress:(sent:number)=>void,xhrRef:{current:XMLHttpRequest|null}){
 return new Promise<number>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhrRef.current=xhr;
  xhr.open("PATCH",url);xhr.setRequestHeader("Tus-Resumable","1.0.0");xhr.setRequestHeader("Upload-Offset",String(offset));xhr.setRequestHeader("Content-Type","application/offset+octet-stream");
  xhr.upload.onprogress=e=>onProgress(e.loaded);
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){const next=Number(xhr.getResponseHeader("Upload-Offset"));resolve(Number.isFinite(next)&&next>offset?next:offset+chunk.size);}else reject(Error(String(xhr.status)));};
  xhr.onerror=()=>reject(Error("network"));xhr.onabort=()=>reject(Error("aborted"));
  xhr.send(chunk);
 });
}
async function serverOffset(url:string){try{const r=await fetch(url,{method:"HEAD",headers:{"Tus-Resumable":"1.0.0"}});const n=Number(r.headers.get("Upload-Offset"));return Number.isFinite(n)?n:null;}catch{return null;}}
function videoDuration(file:File){return new Promise<number|null>(resolve=>{const video=document.createElement("video"),src=URL.createObjectURL(file);const done=(value:number|null)=>{URL.revokeObjectURL(src);resolve(value);};video.preload="metadata";video.onloadedmetadata=()=>done(Number.isFinite(video.duration)?video.duration:null);video.onerror=()=>done(null);setTimeout(()=>done(null),8000);video.src=src;});}

// Listing video upload to Cloudflare Stream: resumable, with progress, then a live preview.
export function VideoUpload({value,onChange,onBusyChange}:{value?:string;onChange:(uid:string)=>void;onBusyChange?:(busy:boolean)=>void}){
 const {t}=useLocale();
 const [progress,setProgress]=useState<number|null>(null),[error,setError]=useState(""),[status,setStatus]=useState<Status|null>(null);
 const xhr=useRef<XMLHttpRequest|null>(null),cancelled=useRef(false);
 const uid=validStreamUid(value)?value:"";
 useEffect(()=>{if(!uid){setStatus(null);return;}let active=true;
  // Poll until Stream finished preparing the video.
  (async()=>{for(let i=0;i<180&&active;i++){try{const r=await fetch(`/api/media/video?uid=${uid}`,{cache:"no-store"});if(r.ok){const s=await apiJson<Status>(r);if(!active)return;setStatus(s);if(s.ready||s.failed)return;}}catch{}await wait(5000);}})();
  return()=>{active=false;};},[uid]);
 async function upload(file:File){
  setError("");
  if(!file.type.startsWith("video/"))return setError("Lütfen bir video dosyası seçin.");
  if(file.size>MAX_VIDEO_BYTES)return setError("Video en fazla 2 GB olabilir.");
  const duration=await videoDuration(file);
  if(duration&&duration>MAX_VIDEO_SECONDS+1)return setError("Video en fazla 10 dakika olabilir.");
  cancelled.current=false;setProgress(0);onBusyChange?.(true);
  try{
   const start=await fetch("/api/media/video",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({size:file.size})}),data=await apiJson<{uid?:string;uploadUrl?:string;error?:string}>(start);
   if(!start.ok||!data.uid||!data.uploadUrl)throw Error(data.error||"Video yüklemesi başlatılamadı. Tekrar deneyin.");
   let offset=0,attempts=0;
   while(offset<file.size){
    const chunk=file.slice(offset,offset+TUS_CHUNK_BYTES);
    try{offset=await sendChunk(data.uploadUrl,offset,chunk,sent=>setProgress((offset+sent)/file.size),xhr);attempts=0;setProgress(offset/file.size);}
    catch(cause){if(cancelled.current)throw cause;if(++attempts>4)throw Error("Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.");await wait(2000*attempts);offset=await serverOffset(data.uploadUrl)??offset;}
   }
   const finish=await fetch("/api/media/video",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({uid:data.uid})});
   if(!finish.ok)throw Error((await apiJson<{error?:string}>(finish)).error||"Video kaydedilemedi. Tekrar deneyin.");
   setStatus({ready:false,failed:false});onChange(data.uid);
  }catch(cause){if(!cancelled.current)setError((cause as Error).message);}
  finally{xhr.current=null;setProgress(null);onBusyChange?.(false);}
 }
 function cancel(){cancelled.current=true;xhr.current?.abort();}
 return <section className="presentation-fields video-upload"><h2>{t("İlan videosu")}</h2><p>{t("Telefonunuzla çektiğiniz videoyu yükleyin: en fazla 10 dakika ve 2 GB. Video her cihazda akıcı oynaması için otomatik hazırlanır.")}</p>
  {progress!=null?<div className="video-upload-progress" role="status"><div><Film size={18}/><strong>{t("Video yükleniyor")} · %{Math.floor(progress*100)}</strong><button type="button" className="outline-button" onClick={cancel}><X size={15}/>{t("İptal")}</button></div><progress max={1} value={progress}/></div>
  :uid?<div className="video-upload-preview">{status?.ready?<div className="stream-frame"><iframe title={t("İlan videosu")} src={streamEmbed(uid)} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy"/></div>:status?.failed?<p className="form-error" role="alert">{t("Video işlenemedi. Başka bir video yükleyin.")}</p>:<p className="video-upload-processing" role="status"><span className="spinner" aria-hidden="true"/>{t("Video hazırlanıyor. İlanınızı şimdi kaydedebilirsiniz; video hazır olunca ilanda görünür.")}</p>}<button type="button" className="outline-button" onClick={()=>onChange("")}><Trash2 size={15}/>{t("Videoyu kaldır")}</button></div>
  :<label className="video-upload-drop"><UploadCloud size={26}/><strong>{t("Video seçin")}</strong><small>MP4, MOV · {t("en fazla 10 dakika")}</small><input type="file" accept="video/*" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}}/></label>}
  {error&&<p className="form-error" role="alert">{t(error)}</p>}
 </section>;
}
