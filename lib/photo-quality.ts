export function smallListingPhoto(width:number,height:number){return Math.max(width,height)<1200||Math.min(width,height)<600;}
export async function checkListingPhoto(file:File){
 const bitmap=await createImageBitmap(file);
 try{if(smallListingPhoto(bitmap.width,bitmap.height))throw Error(`Fotoğraf ${bitmap.width} × ${bitmap.height} piksel; büyük kapakta bulanık görünür. En az 1200 piksel uzun kenar ve 600 piksel kısa kenar içeren orijinal fotoğrafı seçin (önerilen: 1600 × 1200 veya üzeri).`);}
 finally{bitmap.close();}
 // Validate dimensions only. The original file is uploaded without re-encoding.
}
