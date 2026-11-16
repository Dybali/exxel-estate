"use client";
import {useEffect,useState} from "react";
import Link from "@/components/SafeLink";
import {Sparkles} from "lucide-react";
import {apiJson} from "@/lib/api-client";
import {Money,useLocale} from "@/lib/i18n";
import type {CatalogItem,Order} from "@/lib/orders";
import type {BankTransfer} from "@/lib/payment-providers";

type Catalog=Record<CatalogItem,{kind:string;days:number;amount:number;currency:string;label:string}>;
type Data={orders:Order[];catalog:Catalog;bank:BankTransfer|null};
const STATUS:Record<string,string>={awaiting_payment:"Ödeme bekleniyor",fulfilled:"Tamamlandı",cancelled:"İptal edildi"};

export function TransferDetails({bank,order}:{bank:BankTransfer;order:{reference:string;amount:number;currency:string}}){
 const {t}=useLocale();
 return <dl className="transfer-details"><div><dt>{t("Alıcı")}</dt><dd>{bank.accountName}</dd></div>{bank.bankName&&<div><dt>{t("Banka")}</dt><dd>{bank.bankName}</dd></div>}<div><dt>IBAN</dt><dd dir="ltr">{bank.iban}</dd></div><div><dt>{t("Tutar")}</dt><dd><Money value={order.amount} currency={order.currency}/></dd></div><div><dt>{t("Açıklama (zorunlu)")}</dt><dd><strong dir="ltr">{order.reference}</strong></dd></div><p>{t("Havale veya EFT açıklamasına sipariş kodunu yazın. Ödemeniz kontrol edildikten sonra ürün hesabınıza tanımlanır.")}</p></dl>;
}

// "Öne çıkar" control for one published listing in the owner's listing manager.
export function FeatureListing({listingId}:{listingId:string}){
 const {t}=useLocale(),[open,setOpen]=useState(false),[data,setData]=useState<Data|null>(null),[created,setCreated]=useState<{reference:string;amount:number;currency:string}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(open&&!data)fetch("/api/orders",{cache:"no-store"}).then(r=>apiJson<Data>(r)).then(setData).catch(()=>setError("Bilgiler yüklenemedi."));},[open,data]);
 async function order(item:CatalogItem){setBusy(true);setError("");try{const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",item,listingId})});const body=await apiJson<{order?:{reference:string;amount:number;currency:string};error?:string}>(r);if(!r.ok||!body.order)throw Error(body.error||"Sipariş oluşturulamadı.");setCreated(body.order);}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}}
 const pending=data?.orders.find(o=>o.listing_id===listingId&&o.status==="awaiting_payment");
 return <div className="feature-listing"><button type="button" className="outline-button" onClick={()=>setOpen(!open)}><Sparkles size={14}/>{t("Öne çıkar")}</button>
  {open&&<div className="feature-listing-panel">{!data?(!error&&<p>{t("Yükleniyor...")}</p>):!data.bank?<p>{t("Öne çıkarma için ödeme alma henüz etkin değil.")}</p>:created||pending?<TransferDetails bank={data.bank} order={created||pending!}/>:<><p>{t("Öne çıkan ilanlar aramalarda üst sıralarda ve vurgulu gösterilir.")}</p><div className="feature-options">{(["featured-7","featured-30"] as CatalogItem[]).map(item=><button key={item} type="button" disabled={busy} onClick={()=>order(item)}><strong>{t(data.catalog[item].label)}</strong><Money value={data.catalog[item].amount} currency={data.catalog[item].currency}/></button>)}</div></>}
   {error&&<p className="form-error" role="alert">{t(error)}</p>}</div>}
 </div>;
}

// Account tab listing the user's orders with transfer details for unpaid ones.
export function MyOrders(){
 const {t,locale}=useLocale(),[data,setData]=useState<Data|null>(null),[error,setError]=useState("");
 const load=()=>fetch("/api/orders",{cache:"no-store"}).then(r=>apiJson<Data>(r)).then(setData).catch(()=>setError("Bilgiler yüklenemedi."));
 useEffect(()=>{load();},[]);
 async function cancel(id:string){const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel",id})});if(r.ok)load();else setError((await apiJson<{error?:string}>(r)).error||"Sipariş iptal edilemedi.");}
 const date=(iso:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium"}).format(new Date(iso));
 return <section className="my-orders"><h2>{t("Siparişlerim")}</h2>{error&&<p className="form-error">{t(error)}</p>}
  {data&&!data.orders.length&&<p>{t("Henüz siparişiniz yok. İlanlarım bölümünden yayındaki bir ilanı öne çıkarabilirsiniz.")}</p>}
  {data?.orders.map(order=><article key={order.id} className={`order-card order-${order.status}`}><div className="order-head"><strong>{t(data.catalog[order.item]?.label||order.item)}</strong><span>{t(STATUS[order.status]||order.status)}</span></div>
   <p>{order.listing_id&&order.listing_title&&<><Link href={`/ilan/${order.listing_id}`}>{order.listing_title}</Link> · </>}<span dir="ltr">{order.reference}</span> · {date(order.created_at)} · <Money value={order.amount} currency={order.currency}/>{order.featured_until&&order.status==="fulfilled"&&<> · {t("Öne çıkma bitişi")}: {date(order.featured_until)}</>}</p>
   {order.status==="awaiting_payment"&&data.bank&&<><TransferDetails bank={data.bank} order={order}/><button type="button" className="outline-button" onClick={()=>cancel(order.id)}>{t("Siparişi iptal et")}</button></>}
   {order.admin_note&&<p className="order-note">{order.admin_note}</p>}
  </article>)}
 </section>;
}

// Admin: confirm received transfers or cancel unpaid orders.
export function AdminOrders(){
 const {t,locale}=useLocale(),[status,setStatus]=useState("awaiting_payment"),[orders,setOrders]=useState<Order[]|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const load=(value=status)=>fetch(`/api/admin/orders?status=${value}`,{cache:"no-store"}).then(r=>apiJson<{orders:Order[]}>(r)).then(d=>setOrders(d.orders)).catch(()=>setError("Bilgiler yüklenemedi."));
 useEffect(()=>{load(status);},[status]);
 async function act(id:string,action:"fulfill"|"cancel"){if(action==="fulfill"&&!window.confirm(t("Ödemenin hesaba geçtiğini doğruladınız mı? Ürün hemen tanımlanır.")))return;setBusy(id);setError("");try{const r=await fetch("/api/admin/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id})});if(!r.ok)throw Error((await apiJson<{error?:string}>(r)).error||"İşlem yapılamadı.");await load();}catch(cause){setError((cause as Error).message);}finally{setBusy("");}}
 return <section className="admin-card admin-orders"><h2>{t("Siparişler")}</h2><div className="leads-filters">{["awaiting_payment","fulfilled","cancelled"].map(value=><button type="button" key={value} className={status===value?"active":""} onClick={()=>setStatus(value)}>{t(STATUS[value])}</button>)}</div>
  {error&&<p className="form-error">{t(error)}</p>}
  {orders&&!orders.length&&<p>{t("Bu durumda sipariş yok.")}</p>}
  {orders&&orders.length>0&&<table className="listing-import-table"><thead><tr><th>{t("Kod")}</th><th>{t("Ürün")}</th><th>{t("Kullanıcı")}</th><th>{t("Tutar")}</th><th>{t("Tarih")}</th><th/></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td dir="ltr">{o.reference}</td><td>{o.item}{o.listing_title&&<small>{o.listing_title}</small>}</td><td>{o.user_name}<small>{o.user_email}</small></td><td><Money value={o.amount} currency={o.currency}/></td><td>{new Intl.DateTimeFormat(locale,{dateStyle:"short"}).format(new Date(o.created_at))}</td><td>{o.status==="awaiting_payment"&&<><button type="button" className="outline-button" disabled={busy===o.id} onClick={()=>act(o.id,"fulfill")}>{t("Ödeme alındı")}</button> <button type="button" className="outline-button" disabled={busy===o.id} onClick={()=>act(o.id,"cancel")}>{t("İptal")}</button></>}</td></tr>)}</tbody></table>}
 </section>;
}
