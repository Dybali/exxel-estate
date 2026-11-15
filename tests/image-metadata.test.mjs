import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(readFileSync(new URL('../lib/image-metadata.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {stripImageMetadata}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

// TIFF (little-endian): IFD0 = Orientation 6 + GPS pointer; GPS IFD = latitude ref "N" + latitude 3 rationals (out of line).
function exifJpeg(){
  const tiff=new Uint8Array(80),v=new DataView(tiff.buffer);
  tiff.set([0x49,0x49,42,0]);v.setUint32(4,8,true);
  v.setUint16(8,2,true);
  v.setUint16(10,0x0112,true);v.setUint16(12,3,true);v.setUint32(14,1,true);v.setUint16(18,6,true);
  v.setUint16(22,0x8825,true);v.setUint16(24,4,true);v.setUint32(26,1,true);v.setUint32(30,38,true);
  v.setUint32(34,0,true);
  v.setUint16(38,2,true);
  v.setUint16(40,1,true);v.setUint16(42,2,true);v.setUint32(44,2,true);tiff.set([78,0],48);
  v.setUint16(52,2,true);v.setUint16(54,5,true);v.setUint32(56,3,true);v.setUint32(60,68,true);
  const rationals=new DataView(new ArrayBuffer(24));[41,1,2,1,30,1].forEach((n,i)=>rationals.setUint32(i*4,n,true));
  const full=new Uint8Array(68+24);full.set(tiff.subarray(0,68));full.set(new Uint8Array(rationals.buffer),68);
  const exif=new Uint8Array([...Buffer.from('Exif\0\0'),...full]);
  const xmp=Buffer.from('http://ns.adobe.com/xap/1.0/\0<exif:GPSLatitude>41,2.5N</exif:GPSLatitude>');
  const seg=(m,data)=>[0xff,m,(data.length+2)>>8,(data.length+2)&255,...data];
  return {bytes:new Uint8Array([0xff,0xd8,...seg(0xe1,exif),...seg(0xe1,xmp),...seg(0xda,[1,2,3,4]),9,9,9,0xff,0xd9]),exifStart:2+4+6};
}
test('JPEG: GPS block and XMP are removed, orientation and image data stay',()=>{
  const {bytes,exifStart}=exifJpeg(),out=stripImageMetadata(bytes,'image/jpeg'),v=new DataView(out.buffer,out.byteOffset);
  const t=exifStart; // the EXIF segment comes first, so its offset is unchanged
  assert.equal(v.getUint16(t+10,true),0x0112);assert.equal(v.getUint16(t+18,true),6,'orientation kept');
  assert.equal(v.getUint16(t+38,true),0,'GPS IFD emptied');
  assert.deepEqual([...out.subarray(t+68,t+92)],new Array(24).fill(0),'latitude values zeroed');
  assert.ok(!Buffer.from(out).includes('GPSLatitude'),'XMP dropped');
  assert.deepEqual([...out.subarray(-13)],[0xff,0xda,0,6,1,2,3,4,9,9,9,0xff,0xd9],'image data intact');
  assert.ok(Buffer.from(stripImageMetadata(bytes,'image/jpeg',{keepXmp:true})).includes('GPSLatitude'),'panoramas keep XMP');
});
test('PNG: eXIf and text chunks are dropped; WebP: EXIF and XMP chunks are dropped and sizes fixed',()=>{
  const chunk=(type,data)=>{const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length,0);b.write(type,4,'latin1');Buffer.from(data).copy(b,8);return b;};
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',[0,0,0,1,0,0,0,1,8,2,0,0,0]),chunk('eXIf',[1,2,3]),chunk('tEXt',[...Buffer.from('GPS\0x')]),chunk('IDAT',[1]),chunk('IEND',[])]);
  const outPng=Buffer.from(stripImageMetadata(new Uint8Array(png),'image/png'));
  assert.ok(!outPng.includes('eXIf')&&!outPng.includes('tEXt')&&outPng.includes('IDAT')&&outPng.includes('IEND'));
  const wchunk=(type,data)=>{const pad=data.length%2;const b=Buffer.alloc(8+data.length+pad);b.write(type,0,'latin1');b.writeUInt32LE(data.length,4);Buffer.from(data).copy(b,8);return b;};
  const body=Buffer.concat([wchunk('VP8X',[0x0c,0,0,0,0,0,0,0,0,0]),wchunk('VP8 ',[1,2,3,4]),wchunk('EXIF',[5,6,7]),wchunk('XMP ',[8,9])]);
  const webp=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),body]);webp.writeUInt32LE(webp.length-8,4);
  const outWebp=Buffer.from(stripImageMetadata(new Uint8Array(webp),'image/webp'));
  assert.ok(!outWebp.includes('EXIF')&&!outWebp.includes('XMP ')&&outWebp.includes('VP8 '));
  assert.equal(outWebp.readUInt32LE(4),outWebp.length-8,'RIFF size updated');
  assert.equal(outWebp[20]&0x0c,0,'VP8X metadata flags cleared');
});
test('anything that does not parse is returned unchanged',()=>{
  const broken=new Uint8Array([0xff,0xd8,0xff,0xe1,0xff,0xff,1,2]);
  assert.equal(stripImageMetadata(broken,'image/jpeg'),broken);
});
