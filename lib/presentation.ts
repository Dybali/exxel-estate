import {landFrom,type LandDetails} from './land';
import {subtypeFrom} from './property-subtypes';
import {detailsFrom,type ListingDetails} from './listing-details';
import {validVideoId} from './listing-video';
import {validatePanoramas,type PanoramaScene} from './panoramas';
export type Presentation={floorPlan:string;videoUrl:string;tourUrl:string;
 /** Language of the title and description when it is not Turkish (lib/listing-language.ts). */
 language?:import('./listing-language').ListingLanguage;gardenArea?:number;plotArea?:number;panoramas?:PanoramaScene[];eidsNumber?:string;land?:LandDetails;businessType?:string;tourismType?:string;details?:ListingDetails;videoId?:string;
 /** Map pin precision (lib/listing-location.ts); `exact` (the private pin) never leaves the server. */
 location?:import('./listing-location').StoredLocation;
 /** Neighbourhood block (lib/neighborhood-info.ts), written by the server only. */
 nearby?:import('./neighborhood-info').NearbyInfo;
 /** Fraud and duplicate check (lib/listing-risk.ts), written by the server only and never sent to visitors. */
 photoHashes?:Record<string,string>;risk?:import('./listing-risk').StoredRisk;riskFlag?:import('./listing-risk').RiskLevel};
export function videoEmbed(value:string){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;const host=url.hostname.replace(/^www\./,'');if(host==='youtu.be'||host==='youtube.com'){const id=host==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})$/)?.[1];return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:null;}if(host==='vimeo.com'&&/^\/\d{5,12}$/.test(url.pathname))return `https://player.vimeo.com/video/${url.pathname.slice(1)}`;}catch{}return null;
}
export function tourLink(value:string){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;if(url.hostname==='my.matterport.com'&&url.pathname==='/show/'&&/^[A-Za-z0-9]{5,30}$/.test(url.searchParams.get('m')||''))return `https://my.matterport.com/show/?m=${url.searchParams.get('m')}`;if(url.hostname==='kuula.co'&&/^\/(?:post|share)\/[A-Za-z0-9_-]+(?:\/collection\/[A-Za-z0-9_-]+)?$/.test(url.pathname))return url.origin+url.pathname;}catch{}return null;}
export function presentationFrom(data:Record<string,unknown>,ownerId:string):Presentation{
 const read=(key:string)=>{const value=data[key];if(value==null)return '';if(typeof value!=='string'||value.length>500)throw Error('Kat planı, video veya tur bağlantısını kontrol edin.');return value.trim();};
 const floorPlan=read('floorPlan'),videoUrl=read('videoUrl'),tourUrl=read('tourUrl');
 if(floorPlan&&!new RegExp(`^/api/media/listings/${ownerId}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(floorPlan))throw Error('Kat planı ilan sahibinin yüklediği bir görsel olmalıdır.');
 if(videoUrl&&!videoEmbed(videoUrl))throw Error('YouTube veya Vimeo HTTPS video bağlantısı ekleyin.');
 if(tourUrl&&!tourLink(tourUrl))throw Error('Matterport veya Kuula HTTPS tur bağlantısı ekleyin.');
 const area=(key:string)=>{const v=data[key];if(v==null||v==='')return undefined;const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('Bahçe ve arsa alanını pozitif tam sayı olarak girin.');return n;};
 const gardenArea=area('gardenArea'),plotArea=area('plotArea');if(gardenArea!=null&&plotArea!=null&&gardenArea>plotArea)throw Error('Bahçe alanı arsa alanından büyük olamaz.');
 // EİDS number is the advertiser's own statement; the platform has no ministry integration to verify it.
 const eids=data.eidsNumber==null?'':String(data.eidsNumber).trim();if(eids&&!/^[A-Za-z0-9-]{4,40}$/.test(eids))throw Error('EİDS numarası yalnızca harf, rakam ve tire içerebilir (4–40 karakter).');
 const land=data.propertyType==='arsa'?landFrom(data):undefined,details=detailsFrom(data);
 // The site languages (lib/listing-language.ts LISTING_LANGUAGES; kept in step by tests/listing-language.test.mjs).
 const language=data.language==null||data.language===''?'tr':data.language;if(typeof language!=='string'||!/^(tr|de|fr|en|ar|fa|ru|nl)$/.test(language))throw Error('İlan dilini seçin.');
 // Uploaded video (listing_videos id, docs/listing-videos.md); ownership is checked by the listing routes.
 const videoId=data.videoId==null?'':String(data.videoId);if(videoId&&!validVideoId(videoId))throw Error('Video bulunamadı. Videoyu yeniden yükleyin.');
 return {floorPlan,videoUrl,tourUrl:tourUrl?tourLink(tourUrl)!:'',gardenArea,plotArea,panoramas:validatePanoramas(data.panoramas,ownerId),...(eids?{eidsNumber:eids}:{}),...(land?{land}:{}),...subtypeFrom(data),...(details?{details}:{}),...(videoId?{videoId}:{}),...(language!=='tr'?{language:language as Presentation['language']}:{})};
}
