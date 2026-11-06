"use client";
import {useEffect,useRef,useState} from "react";
import type * as Leaflet from "leaflet";
import {Crosshair,MapPin,Trash2} from "lucide-react";
import {apiJson} from "@/lib/api-client";
import {useLocale} from "@/lib/i18n";
import {inTurkey,nearProvince,provinceCenter} from "@/lib/listing-location";

export type PinValue={latitude:string;longitude:string;locationPrecision:string};
type Center={lat:number;lng:number;zoom:number};
const pinIcon=(L:typeof Leaflet)=>L.divIcon({className:"location-picker-pin",html:"<span></span>",iconSize:[30,40],iconAnchor:[15,38]});

/**
 * Optional "Konumu haritada işaretle" step of the listing forms. The map opens on the chosen
 * neighbourhood (server-side Nominatim lookup, /api/locations/center); a click or drag places the
 * pin. The owner picks exact or approximate (default); the server stores and offsets it
 * (lib/listing-location.ts).
 */
export function LocationPicker({city,district,neighborhoodId,value,onChange}:{city:string;district:string;neighborhoodId:string;value:PinValue;onChange:(next:PinValue)=>void}){
 const {t}=useLocale();
 const lat=value.latitude===""?NaN:Number(value.latitude),lng=value.longitude===""?NaN:Number(value.longitude),hasPin=Number.isFinite(lat)&&Number.isFinite(lng);
 const precision=value.locationPrecision==="exact"?"exact":"approximate";
 const [open,setOpen]=useState(hasPin),[failed,setFailed]=useState(false),[ready,setReady]=useState(false);
 const node=useRef<HTMLDivElement>(null),mapRef=useRef<Leaflet.Map|null>(null),api=useRef<typeof Leaflet|null>(null),marker=useRef<Leaflet.Marker|null>(null),latest=useRef({value,onChange});
 latest.current={value,onChange};
 const place=(point:{lat:number;lng:number})=>{const current=latest.current.value;latest.current.onChange({...current,latitude:point.lat.toFixed(5),longitude:point.lng.toFixed(5),locationPrecision:current.locationPrecision||"approximate"});};
 // Leaflet is loaded only when the owner opens the step.
 useEffect(()=>{if(!open)return;let active=true;import("leaflet").then(L=>{if(!active||!node.current||mapRef.current)return;api.current=L;const start=provinceCenter(city);const map=L.map(node.current,{center:start||[39,34],zoom:start?9:6,scrollWheelZoom:false});mapRef.current=map;L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);map.on("click",(event:Leaflet.LeafletMouseEvent)=>place(event.latlng));setReady(true);setTimeout(()=>{if(mapRef.current===map)map.invalidateSize();},80);}).catch(()=>setFailed(true));return()=>{active=false;mapRef.current?.remove();mapRef.current=null;marker.current=null;setReady(false);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 // Keep the marker in step with the form value.
 useEffect(()=>{const map=mapRef.current,L=api.current;if(!ready||!map||!L)return;if(!hasPin){marker.current?.remove();marker.current=null;return;}if(!marker.current){marker.current=L.marker([lat,lng],{draggable:true,icon:pinIcon(L),title:t("Haritadaki iğne"),keyboard:true}).addTo(map);marker.current.on("dragend",()=>place(marker.current!.getLatLng()));}else marker.current.setLatLng([lat,lng]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,hasPin,lat,lng,t]);
 // Centre on the pin, else on the chosen neighbourhood / district / province.
 const pinRef=useRef(hasPin?{lat,lng}:null);pinRef.current=hasPin?{lat,lng}:null;
 useEffect(()=>{const map=mapRef.current;if(!ready||!map)return;const pin=pinRef.current;if(pin){map.setView([pin.lat,pin.lng],Math.max(map.getZoom(),16));return;}if(!city||!district)return;const controller=new AbortController();const q=new URLSearchParams({city,district,...(neighborhoodId?{neighborhoodId}:{})});fetch(`/api/locations/center?${q}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return apiJson<Center>(r);}).then(center=>{if(!controller.signal.aborted&&!pinRef.current)map.setView([center.lat,center.lng],center.zoom);}).catch(()=>{});return()=>controller.abort();},[ready,city,district,neighborhoodId]);
 const problem=hasPin&&!inTurkey(lat,lng)?"Harita konumu Türkiye sınırları içinde olmalıdır.":hasPin&&city&&!nearProvince(city,lat,lng)?"Harita konumu seçtiğiniz ilin içinde olmalıdır.":"";
 const markCenter=()=>{const map=mapRef.current;if(map)place(map.getCenter());};
 const clear=()=>onChange({...value,latitude:"",longitude:""});
 return <div className="location-picker">
  <div className="location-picker-head"><div><strong><MapPin size={16} aria-hidden="true"/> {t("Konumu haritada işaretle")}</strong><p>{t("İsteğe bağlı. İşaretlerseniz ilanınız harita aramasında görünür ve yakın çevre bilgisi eklenir.")}</p></div><button type="button" className="outline-button" onClick={()=>setOpen(!open)} aria-expanded={open} disabled={!city||!district}>{t(open?"Haritayı gizle":"Haritayı aç")}</button></div>
  {!city||!district?<p className="location-picker-note">{t("Önce il ve ilçe seçin.")}</p>:null}
  {open&&city&&district&&<>
   {failed?<p className="location-picker-error" role="alert">{t("Harita şu anda yüklenemedi.")}</p>:<div ref={node} className="location-picker-map" aria-label={t("Konum seçme haritası")}/>}
   <p className="location-picker-note">{t("Haritaya tıklayın veya iğneyi sürükleyin.")}</p>
   <div className="location-picker-actions"><button type="button" className="outline-button" onClick={markCenter} disabled={!ready}><Crosshair size={15} aria-hidden="true"/>{t("Harita merkezini işaretle")}</button>{hasPin&&<button type="button" className="outline-button" onClick={clear}><Trash2 size={15} aria-hidden="true"/>{t("Konumu kaldır")}</button>}{hasPin&&<span className="location-picker-coords" dir="ltr">{lat.toFixed(5)}, {lng.toFixed(5)}</span>}</div>
   {problem&&<p className="location-picker-error" role="alert">{t(problem)}</p>}
   <fieldset className="location-picker-privacy"><legend>{t("Ziyaretçiler ne görsün?")}</legend>
    <label><input type="radio" name="locationPrecision" value="approximate" checked={precision==="approximate"} onChange={()=>onChange({...value,locationPrecision:"approximate"})}/><span><strong>{t("Yaklaşık konum göster")}</strong><small>{t("Ziyaretçiler birkaç yüz metre kaydırılmış bir nokta görür. Tam konum yalnızca sizde kalır.")}</small></span></label>
    <label><input type="radio" name="locationPrecision" value="exact" checked={precision==="exact"} onChange={()=>onChange({...value,locationPrecision:"exact"})}/><span><strong>{t("Tam konumu göster")}</strong><small>{t("İğnenin bulunduğu nokta herkese açık gösterilir.")}</small></span></label>
   </fieldset>
  </>}
 </div>;
}
