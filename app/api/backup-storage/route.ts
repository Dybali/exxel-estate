import {operationsReport} from '@/lib/operations-runtime';
import {env} from '@/lib/runtime';
import {AwsClient} from 'aws4fetch';
import {bucket,sha256} from '@/lib/server';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
type Settings={BACKUP_READ_TOKEN?:string;R2_ENDPOINT?:string;R2_BUCKET_NAME?:string;R2_ACCESS_KEY_ID?:string;R2_SECRET_ACCESS_KEY?:string};
const metadata=(h:Headers)=>({ContentType:h.get('content-type')||undefined,CacheControl:h.get('cache-control')||undefined,ContentDisposition:h.get('content-disposition')||undefined,ContentEncoding:h.get('content-encoding')||undefined,ContentLanguage:h.get('content-language')||undefined,Expires:h.get('expires')?new Date(h.get('expires')!).toISOString():undefined,Metadata:Object.fromEntries([...h.entries()].filter(([k])=>k.startsWith('x-amz-meta-')).map(([k,v])=>[k.slice(11),v]))});
const xmlText=(s:string)=>s.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const tag=(xml:string,name:string)=>{const match=xml.match(new RegExp('<'+name+'>([\\s\\S]*?)</'+name+'>'));return match?xmlText(match[1]):null;};
export async function GET(request:Request){
 const settings=env as unknown as Settings,token=settings.BACKUP_READ_TOKEN||'',provided=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(token.length<48||provided.length>256)return json({error:'Backup authorization required'},401);
 const a=await sha256(token),b=await sha256(provided);let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);if(diff)return json({error:'Backup authorization required'},401);
 if(new URL(request.url).searchParams.get('mode')==='operations'){try{return json(await operationsReport());}catch{return json({error:'Monitoring unavailable'},503);}}
 const q=new URL(request.url).searchParams,source=q.get('source'),mode=q.get('mode')||'list',key=q.get('key')||'',cursor=q.get('cursor');
 if(!['listing-media','private-media'].includes(source||'')||!['list','head','get'].includes(mode))return json({error:'Invalid backup request'},400);
 if(mode!=='list'&&(!key||key.length>1024||key.includes('\0')||key.split('/').some(p=>p==='.'||p==='..')))return json({error:'Invalid object key'},400);
 if(source==='private-media'){
  const store=bucket();if(!store)return json({error:'Storage unavailable'},503);
  if(mode==='list'){const page=await store.list({limit:500,...(cursor?{cursor}:{})});return json({objects:page.objects.map(o=>({key:o.key,size:o.size,etag:o.httpEtag,lastModified:o.uploaded.toISOString()})),cursor:page.truncated?page.cursor:null});}
  if(mode==='head'){const o=await store.head(key);if(!o)return json({error:'Object not found'},404);const h=new Headers();o.writeHttpMetadata(h);return json({size:o.size,etag:o.httpEtag,lastModified:o.uploaded.toISOString(),metadata:{...metadata(h),Metadata:o.customMetadata||{}}});}
  const match=request.headers.get('if-match'),o=await store.get(key,match?{onlyIf:{etagMatches:match.replace(/^"|"$/g,'')}}:undefined);if(!o)return json({error:'Object not found'},404);if(!('body' in o))return json({error:'Source object changed'},412);return new Response(o.body,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(o.size),'Content-Disposition':'attachment'}});
 }
 const {R2_ENDPOINT:endpoint,R2_BUCKET_NAME:name,R2_ACCESS_KEY_ID:accessKeyId,R2_SECRET_ACCESS_KEY:secretAccessKey}=settings;
 if(!endpoint||!name||!accessKeyId||!secretAccessKey||!/^https:\/\/[a-f0-9]+\.eu\.r2\.cloudflarestorage\.com$/.test(endpoint)||!/^[a-z0-9-]+$/.test(name))return json({error:'Storage unavailable'},503);
 const client=new AwsClient({service:'s3',region:'auto',accessKeyId,secretAccessKey});
 if(mode==='list'){const url=new URL(endpoint+'/'+name);url.searchParams.set('list-type','2');url.searchParams.set('max-keys','500');if(cursor)url.searchParams.set('continuation-token',cursor);const response=await client.fetch(url.toString());if(!response.ok)return json({error:'Storage listing failed'},502);const xml=await response.text();if(xml.length>2_000_000||!xml.includes('<ListBucketResult')||xml.includes('<!DOCTYPE'))return json({error:'Invalid storage response'},502);const objects=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(m=>({key:tag(m[1],'Key'),size:Number(tag(m[1],'Size')),etag:tag(m[1],'ETag'),lastModified:new Date(tag(m[1],'LastModified')!).toISOString()}));const truncated=tag(xml,'IsTruncated')==='true',next=tag(xml,'NextContinuationToken');if(truncated&&!next)return json({error:'Incomplete storage response'},502);return json({objects,cursor:truncated?next:null});}
 const url=endpoint+'/'+name+'/'+key.split('/').map(encodeURIComponent).join('/'),response=await client.fetch(url,{method:mode==='head'?'HEAD':'GET',headers:request.headers.has('if-match')?{'If-Match':request.headers.get('if-match')!}:{}});
 if(!response.ok)return json({error:'Object unavailable'},[404,412].includes(response.status)?response.status:502);
 if(mode==='head')return json({size:Number(response.headers.get('content-length')),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')?new Date(response.headers.get('last-modified')!).toISOString():null,metadata:metadata(response.headers)});
 return new Response(response.body,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment',...(response.headers.has('content-length')?{'Content-Length':response.headers.get('content-length')!}:{})}});
}
