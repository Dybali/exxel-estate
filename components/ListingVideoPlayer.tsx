"use client";
import {useState} from "react";
import {useLocale} from "@/lib/i18n";
import {videoFileUrl,videoPosterUrl} from "@/lib/listing-video";

// Self-hosted listing video (docs/listing-videos.md): plain HTML5 player, MP4 streamed with Range
// requests from /api/media/videos/<id>/video.mp4. Hides itself if the file cannot be loaded (still
// processing, removed), so a listing never shows a broken player.
export function ListingVideoPlayer({id,width,height,heading=true,autoPlay=false}:{id:string;width?:number|null;height?:number|null;heading?:boolean;autoPlay?:boolean}){
 const {t}=useLocale(),[failed,setFailed]=useState(false);
 if(failed)return null;
 const ratio=width&&height?`${width} / ${height}`:"16 / 9";
 const player=<div className="listing-video-frame"><video controls playsInline autoPlay={autoPlay} preload="metadata" poster={videoPosterUrl(id)} src={videoFileUrl(id)} style={{aspectRatio:ratio}} aria-label={t("İlan videosu")} onError={()=>setFailed(true)}/></div>;
 return heading?<section className="property-section property-video"><h2>{t("İlan videosu")}</h2>{player}</section>:player;
}
