"use client";
import {useState} from "react";
import Link from "@/components/SafeLink";
import {FileUp} from "lucide-react";
import {apiJson} from "@/lib/api-client";
import {useLocale} from "@/lib/i18n";
import {AMENITIES,PROPERTY_TYPES} from "@/lib/listings";
import {CURRENCIES} from "@/lib/price-filters";
import {importSubmissionId,matchNeighborhood,MAX_IMPORT_LISTINGS,normalizeImport,type ImportCandidate,type RawImport} from "@/lib/listing-import";
import {optimizeListingPhoto} from "@/lib/photo-optimize";

type Row=ImportCandidate&{state:"ready"|"invalid"|"working"|"published"|"pending"|"existing"|"failed";message?:string;listingId?:string};
const childText=(parent:Element,name:string)=>parent.getElementsByTagName(name)[0]?.textContent||"";

function readXml(text:string):RawImport[]{
 const doc=new DOMParser().parseFromString(text,"application/xml");
 if(doc.getElementsByTagName("parsererror").length||doc.documentElement.nodeName!=="listings")throw Error("Geçerli bir <listings> XML dosyası seçin.");
 return Array.from(doc.documentElement.getElementsByTagName("listing")).slice(0,MAX_IMPORT_LISTINGS).map(node=>{
  const fields:Record<string,string>={};
  for(const child of Array.from(node.children))if(child.children.length===0)fields[child.nodeName]=child.textContent||"";
  const translations:RawImport["translations"]={};
  for(const item of Array.from(node.getElementsByTagName("translation")))translations[item.getAttribute("lang")||""]={title:childText(item,"title"),description:childText(item,"description")};
  return {ref:node.getAttribute("ref")||"",fields,currency:node.getElementsByTagName("price")[0]?.getAttribute("currency")||undefined,neighborhoodPostalCode:node.getElementsByTagName("neighborhood")[0]?.getAttribute("postalCode")||undefined,
   amenities:Array.from(node.getElementsByTagName("amenity")).map(a=>a.textContent||""),images:Array.from(node.getElementsByTagName("image")).map(a=>a.textContent||""),translations};
 });
}

const HELP_STEPS=["Örnek dosyayı indirin ve kendi ilanlarınızla doldurun. Her ilan bir <listing> öğesidir ve size ait benzersiz bir ref kodu taşır.","Fotoğrafları herkese açık https adresleriyle ekleyin; sistem onları indirir, küçültür ve filigranlar.","Dosyayı aşağıdan seçin. İlanlar önce kontrol edilir; hatalı olanlar gerekçesiyle tabloda gösterilir.","Hazır ilanları aktar düğmesine basın ve aktarma bitene kadar sayfayı açık tutun. Aynı dosyayı tekrar yüklerseniz ilanlar ikinci kez oluşturulmaz."];

// Bulk listing import from our XML format; each listing goes through the normal publish API.
export function ListingImport(){
 const {t}=useLocale(),[rows,setRows]=useState<Row[]>([]),[error,setError]=useState(""),[running,setRunning]=useState(false);
 const update=(ref:string,patch:Partial<Row>)=>setRows(old=>old.map(row=>row.ref===ref?{...row,...patch}:row));
 async function choose(file:File|undefined){setError("");setRows([]);if(!file)return;if(file.size>2_000_000){setError("XML dosyası en fazla 2 MB olabilir.");return;}
  try{const raw=readXml(await file.text());const options={propertyTypes:PROPERTY_TYPES.map(p=>p.value),amenities:AMENITIES,currencies:CURRENCIES};const seen=new Set<string>();
   setRows(raw.map(item=>{const candidate=normalizeImport(item,options);if(seen.has(candidate.ref))candidate.errors.push("Aynı ref birden fazla kez kullanılmış.");seen.add(candidate.ref);return {...candidate,state:candidate.errors.length?"invalid":"ready"};}));}
  catch(cause){setError((cause as Error).message);}}
 async function photo(url:string){
  const r=await fetch("/api/media/fetch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
  if(!r.ok){const data=await apiJson<{error?:string}>(r).catch(()=>({error:""}));throw Error(data.error||"Fotoğraf indirilemedi.");}
  const blob=await r.blob(),original=new File([blob],url.split("/").pop()||"photo",{type:blob.type});
  const prepared=await optimizeListingPhoto(original).catch(()=>original);
  const form=new FormData();form.append("file",prepared);
  const upload=await fetch("/api/media",{method:"POST",body:form}),data=await apiJson<{url?:string;error?:string}>(upload);
  if(!upload.ok||!data.url)throw Error(data.error||"Fotoğraf yüklenemedi.");return data.url;}
 async function run(){
  setRunning(true);setError("");
  try{
   const account=await apiJson<{user?:{id:string}}>(await fetch("/api/account",{cache:"no-store"}));if(!account.user)throw Error("İlan vermek için giriş yapın.");
   const places=new Map<string,{id:number;name:string;postalCode?:string}[]>();
   for(const row of rows.filter(item=>item.state==="ready"||item.state==="failed")){
    update(row.ref,{state:"working",message:""});
    try{
     const payload=row.payload as {city:string;district:string};const placeKey=`${payload.city}|${payload.district}`;
     if(!places.has(placeKey)){const r=await fetch(`/api/locations?${new URLSearchParams({city:payload.city,district:payload.district})}`);const data=await apiJson<{neighborhoods?:{id:number;name:string;postalCode?:string}[]}>(r);places.set(placeKey,r.ok?data.neighborhoods||[]:[]);}
     const neighborhood=matchNeighborhood(places.get(placeKey)!,row.neighborhood,row.postalCode);if(!neighborhood)throw Error(t("Mahalle bulunamadı veya birden fazla eşleşti: {name}").replace("{name}",row.neighborhood));
     const images:string[]=[];for(const url of row.images)images.push(await photo(url));
     const r=await fetch("/api/listings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...row.payload,neighborhoodId:neighborhood.id,images,submissionId:await importSubmissionId(account.user.id,row.ref)})});
     const data=await apiJson<{id?:string;status?:string;error?:string}>(r);
     if(r.status===409){update(row.ref,{state:"existing",message:data.error});continue;}
     if(!r.ok||!data.id)throw Error(data.error||"İlan kaydedilemedi.");
     update(row.ref,{state:data.status==="published"?"published":"pending",listingId:data.id});
    }catch(cause){update(row.ref,{state:"failed",message:(cause as Error).message});}
   }
  }catch(cause){setError((cause as Error).message);}finally{setRunning(false);}
 }
 const label:Record<Row["state"],string>={ready:"Hazır",invalid:"Hatalı",working:"Aktarılıyor...",published:"Yayında",pending:"İncelemede",existing:"Daha önce aktarılmış",failed:"Aktarılamadı"};
 const ready=rows.filter(row=>row.state==="ready"||row.state==="failed").length;
 return <article className="listing-import"><h3><FileUp size={17}/>{t("XML ile toplu ilan aktarma")}</h3>
  <p>{t("İlanlarınızı belgelenmiş XML biçimimizle tek seferde aktarın. Her ilan normal ilan kurallarından geçer; fotoğraflar küçültülür ve filigranlanır.")} <Link href="/xml-ornek-ilanlar.xml">{t("Örnek XML dosyası")}</Link></p>
  <details className="listing-import-help"><summary>{t("XML nedir, nasıl kullanılır?")}</summary>
   <p>{t("XML, ilan bilgilerinizi bilgisayarların okuyabildiği düzenli bir metin dosyasıdır. Çoğu emlak yazılımı portföyünüzü XML olarak dışa aktarabilir; yazılım firmanızdan dosyayı aşağıdaki biçimde hazırlamasını isteyebilirsiniz.")}</p>
   <ol>{HELP_STEPS.map(step=><li key={step}>{t(step)}</li>)}</ol>
   <p>{t("Tüm alanlar, kurallar ve örnek için")} <Link href="/toplu-ilan">{t("Toplu ilan yükleme rehberi")} →</Link></p>
  </details>
  <label className="outline-button listing-import-file"><input type="file" accept=".xml,application/xml,text/xml" disabled={running} onChange={e=>choose(e.target.files?.[0])}/>{t("XML dosyası seçin")}</label>
  {error&&<p className="form-error" role="alert">{t(error)}</p>}
  {rows.length>0&&<><table className="listing-import-table"><thead><tr><th>ref</th><th>{t("Başlık")}</th><th>{t("Durum")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.ref||row.payload.title as string} className={`import-${row.state}`}><td>{row.ref}</td><td>{row.listingId?<Link href={`/ilan/${row.listingId}`}>{String(row.payload.title)}</Link>:String(row.payload.title)}</td><td>{t(label[row.state])}{(row.errors.length>0||row.message)&&<small>{[...row.errors,row.message].filter(Boolean).map(x=>t(String(x))).join(" · ")}</small>}</td></tr>)}</tbody></table>
   <button type="button" className="header-post" disabled={running||!ready} onClick={run}>{t(running?"Aktarılıyor...":"Hazır ilanları aktar")} ({ready})</button></>}
 </article>;
}
