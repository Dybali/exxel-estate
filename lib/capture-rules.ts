export const CAPTURE_LIMITS={minPhotos:12,maxPhotos:40,photoBytes:6_000_000,resultBytes:8_000_000,leaseMs:120_000,ttlMs:24*60*60*1000,maxAttempts:3};
export function captureInput(value:Record<string,unknown>){
 const name=typeof value.name==='string'?value.name.trim():'';
 const count=Number(value.count),hfov=value.hfov===undefined?null:Number(value.hfov);
 if(!name||name.length>60)throw Error('Oda adı 1–60 karakter olmalıdır.');
 if(!Number.isInteger(count)||count<CAPTURE_LIMITS.minPhotos||count>CAPTURE_LIMITS.maxPhotos)throw Error('Aynı odadan, birbiriyle örtüşen 12–40 JPG seçin.');
 if(hfov!==null&&(!Number.isFinite(hfov)||hfov<35||hfov>110))throw Error('Yatay görüş açısı 35–110 derece arasında olmalıdır.');
 return {name,count,hfov};
}
export function jpegSize(bytes:Uint8Array){
 if(bytes[0]!==255||bytes[1]!==216)throw Error('Geçerli JPG gerekli.');
 for(let p=2;p+8<bytes.length;){if(bytes[p++]!==255)continue;const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;if(marker===0xff||marker===0||marker>=0xd0&&marker<=0xd7)continue;const size=(bytes[p]<<8)|bytes[p+1];if(size<2||p+size>bytes.length)break;
 if([0xc0,0xc1,0xc2].includes(marker)){const height=(bytes[p+3]<<8)|bytes[p+4],width=(bytes[p+5]<<8)|bytes[p+6];if(width<320||height<240||width*height>16_000_000)throw Error('JPG çözünürlüğü 320 × 240 ile 16 megapiksel arasında olmalıdır.');return {width,height};}p+=size;}
 throw Error('JPG boyutları doğrulanamadı.');
}
