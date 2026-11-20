// Listing photo size rules (owner's request 2026-11-20: phone and WhatsApp photos must go through).
// smallListingPhoto: below 1200 × 600 the photo is accepted, and the photo list shows a "low resolution" note
// (components/PhotoManager.tsx) because a large cover would look blurred.
// tooSmallListingPhoto: only really tiny images (thumbnails, icons) are refused before upload.
export function smallListingPhoto(width:number,height:number){return Math.max(width,height)<1200||Math.min(width,height)<600;}
export function tooSmallListingPhoto(width:number,height:number){return Math.max(width,height)<480||Math.min(width,height)<320;}
export async function checkListingPhoto(file:File){
 const bitmap=await createImageBitmap(file);
 try{if(tooSmallListingPhoto(bitmap.width,bitmap.height))throw Error('Fotoğraf çok küçük. En az 480 × 320 piksel olan bir fotoğraf seçin; daha büyük fotoğraflar ilanda daha net görünür.');}
 finally{bitmap.close();}
 // Validate dimensions only; lib/photo-optimize.ts resizes and re-encodes before upload.
}
