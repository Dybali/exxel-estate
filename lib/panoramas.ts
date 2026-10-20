export type PanoramaHotSpot={id:string;targetId:string;pitch:number;yaw:number};
export type PanoramaScene={id:string;name:string;url:string;hotSpots?:PanoramaHotSpot[];planPosition?:{x:number;y:number};startView?:{pitch:number;yaw:number}};
export const MAX_PANORAMAS=8;
export function readPanoramas(value:unknown):PanoramaScene[]{
 try{const list=typeof value==='string'?JSON.parse(value):value;return Array.isArray(list)?list.filter((x):x is PanoramaScene=>Boolean(x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.url==='string')).slice(0,MAX_PANORAMAS):[];}catch{return [];}
}
export function validatePanoramas(value:unknown,ownerId:string):PanoramaScene[]{
 if(value==null||value==='')return [];
 let list:unknown;try{list=typeof value==='string'?JSON.parse(value):value;}catch{throw Error('360° oda bilgilerini kontrol edin.');}
 if(!Array.isArray(list)||list.length>MAX_PANORAMAS)throw Error('En fazla 8 adet 360° oda ekleyebilirsiniz.');
 const prefix=`/api/media/listings/${ownerId}/`;
 const result=list.map((item:unknown)=>{if(!item||typeof item!=='object')throw Error('360° oda bilgileri geçersiz.');const x=item as Record<string,unknown>;
  if(typeof x.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>60||typeof x.url!=='string'||!x.url.startsWith(prefix)||!/^[-a-f0-9]+\.jpg$/.test(x.url.slice(prefix.length)))throw Error('360° odalara bir ad verin ve yalnızca kendi yüklediğiniz JPG panoramaları kullanın.');
  const scene:PanoramaScene={id:x.id,name:x.name.trim(),url:x.url};
  const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(x.planPosition!=null){const point=x.planPosition as Record<string,unknown>;if(typeof point!=='object'||!finite(point.x,0,100)||!finite(point.y,0,100))throw Error('Kat planındaki oda konumu geçersiz.');scene.planPosition={x:Number(point.x),y:Number(point.y)};}
  if(x.startView!=null){const view=x.startView as Record<string,unknown>;if(typeof view!=='object'||!finite(view.pitch,-85,85)||!finite(view.yaw,-180,180))throw Error('Tur başlangıç açısı geçersiz.');scene.startView={pitch:Number(view.pitch),yaw:Number(view.yaw)};}
  if(x.hotSpots!=null){if(!Array.isArray(x.hotSpots)||x.hotSpots.length>7)throw Error('Bir odada en fazla 7 geçiş oku ekleyebilirsiniz.');scene.hotSpots=x.hotSpots.map((value:unknown)=>{if(!value||typeof value!=='object')throw Error('Geçiş oku bilgileri geçersiz.');const link=value as Record<string,unknown>;if(typeof link.id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(link.id)||typeof link.targetId!=='string'||!finite(link.pitch,-85,85)||!finite(link.yaw,-180,180))throw Error('Geçiş oku bilgileri geçersiz.');return {id:link.id,targetId:link.targetId,pitch:Number(link.pitch),yaw:Number(link.yaw)};});}
  return scene;});
 if(new Set(result.map(x=>x.id)).size!==result.length||new Set(result.map(x=>x.url)).size!==result.length)throw Error('Aynı 360° oda birden fazla eklenemez.');
 const ids=new Set(result.map(x=>x.id));for(const scene of result){const links=scene.hotSpots||[];if(links.some(link=>link.targetId===scene.id||!ids.has(link.targetId))||new Set(links.map(link=>link.id)).size!==links.length||new Set(links.map(link=>link.targetId)).size!==links.length)throw Error('Geçiş okları farklı ve mevcut odalara bağlanmalıdır.');}
 return result;
}
export function removePanorama(scenes:PanoramaScene[],id:string){return scenes.filter(scene=>scene.id!==id).map(scene=>({...scene,...(scene.hotSpots?{hotSpots:scene.hotSpots.filter(link=>link.targetId!==id)}:{})}));}
// Read JPEG SOF dimensions without decoding a potentially oversized image on the server.
export function panoramaDimensions(bytes:Uint8Array){
 if(bytes[0]!==255||bytes[1]!==216)throw Error('360° fotoğraf JPG biçiminde olmalıdır.');
 let offset=2;
 while(offset+4<bytes.length){if(bytes[offset++]!==255)throw Error('360° JPG dosyası okunamadı.');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
  const length=bytes[offset]*256+bytes[offset+1];if(length<2||offset+length>bytes.length)break;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){const height=bytes[offset+3]*256+bytes[offset+4],width=bytes[offset+5]*256+bytes[offset+6];if(length<8||width<1024||width>4096||height<512||height>2048||Math.abs(width/height-2)>.02)throw Error('360° görsel 2:1 oranında, 1024×512 ile 4096×2048 arasında tam küresel panorama olmalıdır.');return {width,height};}offset+=length;
 }
 throw Error('360° JPG boyutları doğrulanamadı.');
}
