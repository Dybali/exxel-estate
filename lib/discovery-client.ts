export type SavedSearch={id:string;name:string;query:string;enabled:boolean;created_at:string;seen_at:string};
export type DiscoveryAlert={id:string;kind:"search"|"price";direction?:"up"|"down";name:string;count?:number;oldPrice?:number;newPrice?:number;currency?:string;createdAt:string;href:string};
export type DiscoveryFeed={searches:SavedSearch[];alerts:DiscoveryAlert[];unread:number;checkedAt:string;priceEnabled:boolean};
export async function discoveryAction(data:Record<string,unknown>){
 const response=await fetch("/api/discovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 if(response.status===401){window.location.assign(`/giris?next=${encodeURIComponent(window.location.pathname+window.location.search)}`);throw new Error("Giriş gerekli.");}
 const result=await response.json();if(!response.ok)throw new Error(result.error||result.message||"İşlem tamamlanamadı.");
 window.dispatchEvent(new Event("salesorrent:discovery-changed"));return result;
}
