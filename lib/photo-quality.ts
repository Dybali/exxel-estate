export function smallListingPhoto(width:number,height:number){return Math.max(width,height)<1200||Math.min(width,height)<600;}
export async function checkListingPhoto(file:File){
 const bitmap=await createImageBitmap(file);
 try{if(smallListingPhoto(bitmap.width,bitmap.height))throw Error(`Fotoğraf çözünürlüğü düşük; büyük kapakta bulanık görünür. En az 1200 × 600 piksel olan orijinal fotoğrafı seçin (önerilen 1600 × 1200 veya üzeri). Bu fotoğraf: ${bitmap.width} × ${bitmap.height}`);}
 finally{bitmap.close();}
 // Validate dimensions only; lib/photo-optimize.ts resizes and re-encodes before upload.
}
