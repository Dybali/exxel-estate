import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import ts from 'typescript';import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),nativeRequire=createRequire(import.meta.url);
function load(file,overrides={}){const full=path.resolve(root,file),module={exports:{}};const code=ts.transpile(readFileSync(full,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true});new Function('require','module','exports',code)(name=>{if(overrides[name])return overrides[name];if(name.startsWith('.')||name.startsWith('@/')){const resolved=name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(full),name);return load(resolved+'.ts',overrides);}return nativeRequire(name);},module,module.exports);return module.exports;}
const media=load('lib/listing-media.ts');
const owner='af102d54-cbdf-438f-b531-1e5c9d233b87',other='0b6f3a52-7d0e-4c1a-9a8e-2f4b1c3d5e6f',photo='3c9e1f20-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const mainKey=`listings/${owner}/${photo}.jpg`;

// Smallest WebP header the checks read: RIFF/WEBP + a lossy VP8 key frame with the given size.
function webp(width,height,{extra=0,chunk='VP8 '}={}){
 const bytes=new Uint8Array(40+extra);const text=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};
 text(0,'RIFF');new DataView(bytes.buffer).setUint32(4,bytes.length-8,true);text(8,'WEBP');text(12,chunk);new DataView(bytes.buffer).setUint32(16,bytes.length-20,true);
 if(chunk==='VP8 '){bytes.set([0x9d,0x01,0x2a],23);new DataView(bytes.buffer).setUint16(26,width,true);new DataView(bytes.buffer).setUint16(28,height,true);}
 if(chunk==='VP8X'){const w=width-1,h=height-1;bytes.set([w&255,(w>>8)&255,w>>16,h&255,(h>>8)&255,h>>16],24);}
 return bytes;
}

test('variant keys derive from the main key; only main listing photos have variants',()=>{
 assert.equal(media.photoVariantKey(mainKey,640),`listings/${owner}/${photo}.w640.webp`);
 assert.equal(media.photoVariantKey(`listings/${owner}/${photo}.webp`,1280),`listings/${owner}/${photo}.w1280.webp`);
 assert.deepEqual(media.photoVariantKeys(mainKey),[`listings/${owner}/${photo}.w640.webp`,`listings/${owner}/${photo}.w1280.webp`]);
 assert.equal(media.photoVariantKey(mainKey,800),null,'only the known sizes');
 assert.equal(media.photoVariantKey(`listings/${owner}/${photo}.w640.webp`,640),null,'no variant of a variant');
 assert.equal(media.photoVariantKey(`videos/${photo}/poster.jpg`,640),null);
 assert.equal(media.photoVariantKey(`listings/${owner}/../${other}/${photo}.jpg`,640),null);
 assert.deepEqual(media.photoVariantKeys('k1'),[]);
 for(const value of ['640','1280',640])assert.ok(media.photoVariantWidth(value));
 for(const value of ['0','64','6400','640px','',null,undefined,' 640'])assert.equal(media.photoVariantWidth(value),null);
 // Every derived key passes the storage key check of lib/external-r2.ts.
 const r2=readFileSync(path.join(root,'lib/external-r2.ts'),'utf8'),pattern=new RegExp(r2.match(/if \(!\/(.+?)\/\.test\(key\)\) throw new Error\("Invalid R2 object key"\)/)[1]);
 for(const key of [mainKey,...media.photoVariantKeys(mainKey)])assert.ok(pattern.test(key),key);
 assert.ok(!pattern.test(`listings/${owner}/${photo}.w800.webp`));assert.ok(!pattern.test(`listings/${owner}/${photo}.w640.jpg`));
});

test('page addresses: ?w= and srcset for our own photos, anything else unchanged',()=>{
 const url=`/api/media/${mainKey}`;
 assert.equal(media.photoVariantUrl(url,640),`${url}?w=640`);
 assert.equal(media.photoSrcSet(url),`${url}?w=640 640w, ${url}?w=1280 1280w, ${url} 2560w`);
 for(const outside of ['https://images.example.com/a.jpg','/images/demo.webp','/api/media/videos/x/poster.jpg',`${url}?w=640`]){assert.equal(media.photoVariantUrl(outside,640),outside);assert.equal(media.photoSrcSet(outside),undefined);}
});

test('a variant can only be stored next to the uploader\'s own main key',()=>{
 assert.equal(media.variantUploadKey(mainKey,owner,640),`listings/${owner}/${photo}.w640.webp`);
 assert.equal(media.variantUploadKey(mainKey,other,640),null,'another member\'s photo');
 assert.equal(media.variantUploadKey(`listings/${other}/${photo}.jpg`,owner,640),null);
 assert.equal(media.variantUploadKey(`listings/${owner}/${photo}.w640.webp`,owner,1280),null);
 assert.equal(media.variantUploadKey(mainKey,owner,2560),null);
});

test('variant validation: real WebP, within byte limit and pixel size',()=>{
 assert.deepEqual(media.webpDimensions(webp(640,427)),{width:640,height:427});
 assert.deepEqual(media.webpDimensions(webp(1280,960,{chunk:'VP8X'})),{width:1280,height:960});
 assert.ok(media.validPhotoVariant(webp(640,427),'image/webp',640));
 assert.ok(media.validPhotoVariant(webp(427,640),'image/webp',640));
 assert.ok(media.validPhotoVariant(webp(1280,853),'image/webp',1280));
 assert.ok(!media.validPhotoVariant(webp(1280,853),'image/webp',640),'larger than its slot');
 assert.ok(!media.validPhotoVariant(webp(2560,1707),'image/webp',1280));
 assert.ok(!media.validPhotoVariant(webp(640,427),'image/jpeg',640),'WebP only');
 assert.ok(!media.validPhotoVariant(webp(640,427,{extra:1_000_000}),'image/webp',640),'byte limit');
 const jpeg=new Uint8Array(64);jpeg.set([255,216,255]);assert.ok(!media.validPhotoVariant(jpeg,'image/webp',640),'signature');
 const broken=webp(640,427);broken[23]=0;assert.ok(!media.validPhotoVariant(broken,'image/webp',640),'header');
 assert.ok(!media.validPhotoVariant(new Uint8Array(0),'image/webp',640));
});

test('media cleanup removes variants too, ignoring missing ones',async()=>{
 const removed=[];
 const failed=await media.removeListingMedia([mainKey,'k2'],async key=>{if(key.includes('.w1280.'))throw Error('not found');removed.push(key);});
 assert.equal(failed,0,'a missing variant is not a failure');
 assert.deepEqual(removed.sort(),[mainKey,'k2',`listings/${owner}/${photo}.w640.webp`].sort());
 // Every place that deletes listing, project or account media goes through removeListingMedia.
 for(const file of ['app/api/listings/[id]/route.ts','app/api/account-security/route.ts','lib/projects-server.ts'])assert.match(readFileSync(path.join(root,file),'utf8'),/removeListingMedia\(/,file);
});

// Upload route with in-memory storage and rate limiter.
function uploadRoute(user){
 const puts=[],limits=[];
 const server={currentUser:async()=>user,sameOrigin:()=>true,db:()=>({}),bucket:()=>null,sha256:async value=>value,error:(message,status=400)=>Response.json({error:message},{status}),ok:(data,init)=>Response.json(data,init)};
 const route=load('app/api/media/route.ts',{'@/lib/server':server,'@/lib/recovery-service':{consumeRateLimit:async(_db,key)=>{limits.push(key);},RecoveryError:class extends Error{}},'@/lib/external-r2':{externalR2Ready:()=>true,putExternalImage:async(key,bytes,type)=>{puts.push({key,type,size:bytes.length});}},'@/lib/listing-risk':{validPhotoHash:()=>false}});
 return {route,puts,limits};
}
const upload=(route,fields,purpose='')=>{const form=new FormData();for(const [name,value] of Object.entries(fields))form.append(name,value);return route.POST(new Request('https://site.test/api/media'+(purpose?`?purpose=${purpose}`:''),{method:'POST',body:form}));};
const file=(bytes,type='image/webp')=>new File([bytes],'photo',{type});

test('upload: variants are stored next to the generated main key and count once against the limit',async()=>{
 const {route,puts,limits}=uploadRoute({id:owner,role:'individual'});
 const response=await upload(route,{file:file(webp(2560,1707)),variant640:file(webp(640,427)),variant1280:file(webp(1280,853)),key:`listings/${other}/${photo}.jpg`,target:`listings/${other}/${photo}.w640.webp`});
 assert.equal(response.status,201);
 const {url}=await response.json(),key=url.slice('/api/media/'.length);
 assert.match(key,new RegExp(`^listings/${owner}/[a-f0-9-]+\\.webp$`));
 // The copies are stored in parallel, so compare without depending on their order.
 assert.equal(puts[0].key,key);assert.deepEqual(puts.map(p=>p.key).sort(),[key,...media.photoVariantKeys(key)].sort());
 assert.ok(puts.every(p=>p.key.startsWith(`listings/${owner}/`)),'client-named keys are ignored');
 assert.ok(puts.slice(1).every(p=>p.type==='image/webp'));
 assert.equal(limits.filter(k=>k===`upload:${owner}`).length,1);
});

test('upload: a bad variant refuses the whole upload; panoramas and avatars take none',async()=>{
 const {route,puts}=uploadRoute({id:owner,role:'individual'});
 assert.equal((await upload(route,{file:file(webp(2560,1707)),variant640:file(webp(1280,853))})).status,400);
 assert.equal((await upload(route,{file:file(webp(2560,1707)),variant640:file(webp(640,427),'image/png')})).status,400);
 assert.equal((await upload(route,{file:file(webp(2560,1707)),variant1280:'listings/x/y.webp'})).status,400);
 assert.equal(puts.length,0);
 assert.equal((await upload(route,{file:file(webp(800,600)),variant640:file(webp(640,480))},'profile')).status,201);
 assert.equal(puts.length,1,'profile photo stored without a copy');
});

// Read route: same access rules for ?w=, variant when stored, original otherwise.
function readRoute({row,user=null,stored}){
 const server={db:()=>({prepare:()=>({bind:()=>({first:async()=>row})})}),currentUser:async()=>user,isAdmin:u=>u?.role==='admin',bucket:()=>null};
 const requested=[];
 const route=load('app/api/media/[...key]/route.ts',{'@/lib/server':server,'@/lib/external-r2':{getExternalImage:async key=>{requested.push(key);return stored[key]?{body:stored[key],contentType:key.endsWith('.webp')?'image/webp':'image/jpeg'}:null;}},'@/lib/projects':{projectMediaPublic:async()=>false},'@/lib/projects-server':{projectsDB:()=>null},'@/lib/services':{serviceMediaPublic:async()=>false},'@/lib/services-server':{servicesDB:()=>null},'@/lib/contractors':{contractorMediaPublic:async()=>false},'@/lib/contractors-server':{contractorsDB:()=>null},'@/lib/listing-video-server':{videoFeatureEnabled:()=>false,videoStorageFromEnv:()=>null}});
 const get=(key,query='')=>route.GET(new Request(`https://site.test/api/media/${key}${query}`),{params:Promise.resolve({key:key.split('/')})});
 return {get,requested};
}

test('serving: the variant when stored, otherwise the original, with the same access and cache rules',async()=>{
 const variant=media.photoVariantKey(mainKey,640),published={status:'published',owner_id:owner};
 const both=readRoute({row:published,stored:{[mainKey]:'original',[variant]:'small'}});
 const small=await both.get(mainKey,'?w=640');assert.equal(await small.text(),'small');assert.equal(small.headers.get('content-type'),'image/webp');assert.equal(small.headers.get('cache-control'),'public,max-age=31536000,immutable');
 assert.equal(await (await both.get(mainKey)).text(),'original');
 assert.equal(await (await both.get(mainKey,'?w=999')).text(),'original','unknown size: original');
 const old=readRoute({row:published,stored:{[mainKey]:'original'}});
 const fallback=await old.get(mainKey,'?w=1280');assert.equal(fallback.status,200);assert.equal(await fallback.text(),'original');assert.deepEqual(old.requested,[media.photoVariantKey(mainKey,1280),mainKey]);
 // A variant path is never served directly; access is decided on the main key.
 assert.equal((await both.get(variant)).status,404);
 const hidden={status:'pending',owner_id:owner};
 assert.equal((await readRoute({row:hidden,stored:{[mainKey]:'o',[variant]:'s'}}).get(mainKey,'?w=640')).status,404);
 assert.equal((await readRoute({row:hidden,user:{id:other,role:'individual'},stored:{[mainKey]:'o',[variant]:'s'}}).get(mainKey,'?w=640')).status,404);
 const own=await readRoute({row:hidden,user:{id:owner,role:'individual'},stored:{[mainKey]:'o',[variant]:'s'}}).get(mainKey,'?w=640');
 assert.equal(await own.text(),'s');assert.equal(own.headers.get('cache-control'),'private,no-store');
});
