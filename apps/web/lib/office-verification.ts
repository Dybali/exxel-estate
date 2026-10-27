export const OFFICE_MAX_BYTES=5*1024*1024;
export type OfficeVerification={user_id:string;document_id:string;document_number:string;company_snapshot:string;content_type:string;byte_size:number;state:'pending'|'approved'|'rejected';note:string;version:number;created_at:string;updated_at:string;reviewed_at:string|null};
export const OFFICE_STATES={pending:'İnceleme bekliyor',approved:'Belge onaylandı',rejected:'Düzeltme gerekli'};
export const OFFICE_SCHEMA=[`CREATE TABLE IF NOT EXISTS office_verifications (
 user_id TEXT PRIMARY KEY,document_id TEXT NOT NULL UNIQUE,document_number TEXT NOT NULL,company_snapshot TEXT NOT NULL,
 object_key TEXT NOT NULL,content_type TEXT NOT NULL,byte_size INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
 note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 reviewer_id TEXT,reviewed_at TEXT,last_action TEXT NOT NULL DEFAULT ''
)`,`CREATE INDEX IF NOT EXISTS office_verifications_state ON office_verifications(state,updated_at)`];
export const OFFICE_PUBLIC_FIELDS='user_id,document_id,document_number,company_snapshot,content_type,byte_size,state,note,version,created_at,updated_at,reviewed_at';
export function officeFileType(bytes:Uint8Array,type:string){
 const starts=(values:number[])=>values.every((v,i)=>bytes[i]===v);
 if(bytes.length<16)throw Error('Belge dosyası geçersiz.');
 if(type==='application/pdf'&&starts([37,80,68,70,45]))return 'pdf';
 if(type==='image/jpeg'&&starts([255,216,255]))return 'jpg';
 if(type==='image/png'&&starts([137,80,78,71,13,10,26,10]))return 'png';
 throw Error('Geçerli PDF, JPG veya PNG dosyası yükleyin.');
}
export async function readOfficeFile(request:Request){
 if(Number(request.headers.get('content-length')||0)>OFFICE_MAX_BYTES)throw Error('Belge en fazla 5 MB olabilir.');
 const reader=request.body?.getReader();if(!reader)throw Error('Bir belge seçin.');
 const parts:Uint8Array[]=[];let size=0;
 while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>OFFICE_MAX_BYTES){await reader.cancel();throw Error('Belge en fazla 5 MB olabilir.');}parts.push(item.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
