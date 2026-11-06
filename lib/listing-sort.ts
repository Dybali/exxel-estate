import type {RateSnapshot} from './tcmb';
import {LEGACY_CURRENCIES} from './price-filters';
export const LISTING_SORTS=['new','newest','priceAsc','priceDesc','area'] as const;
export type ListingSort=typeof LISTING_SORTS[number];
type Sortable={id:string;price:number;currency:string;grossArea:number;featured?:boolean;createdAt?:string;publishedAt?:string};
export const listingSort=(value:string|null):ListingSort=>(LISTING_SORTS as readonly string[]).includes(value||'')?value as ListingSort:'new';
// Sorts that ignore the featured flag and need demo and customer listings merged in one order.
export const strictSort=(sort:ListingSort)=>sort!=='new';
export const priceSort=(sort:ListingSort)=>sort==='priceAsc'||sort==='priceDesc';
/** TL per unit for TRY and every legacy listing currency the bulletin covers (lib/tcmb.ts). */
export function tlRates(rates:RateSnapshot|null){
 const table:Record<string,number>={TRY:1};
 for(const code of LEGACY_CURRENCIES){const rate=rates?.rates?.[code];if(typeof rate==='number'&&Number.isFinite(rate)&&rate>0)table[code]=rate;}
 return table;
}
/**
 * Price in Turkish lira as SQL: TRY rows as stored, legacy EUR/USD/GBP rows converted with the
 * request's TCMB bulletin, NULL for a currency without a rate. Rates are validated numbers from the
 * bulletin, written as literals; the currency codes come from a fixed list.
 */
export function tlPriceSql(rates:Record<string,number>,alias='l'){
 const cases=Object.entries(rates).filter(([code,rate])=>/^[A-Z]{3}$/.test(code)&&Number.isFinite(rate)&&rate>0).map(([code,rate])=>`WHEN '${code}' THEN ${code==='TRY'?'1':Number(rate).toFixed(6)}`).join(' ');
 return `(${alias}.price*CASE ${alias}.currency ${cases} ELSE NULL END)`;
}
/** The same value in memory (demo listings); undefined without a rate. */
export const tlPrice=(item:{price:number;currency:string},rates:Record<string,number>)=>rates[item.currency]?item.price*rates[item.currency]:undefined;
export function listingOrderSql(sort:ListingSort,rates:Record<string,number>={TRY:1}){
 const price=tlPriceSql(rates);
 // Rows without a TL value (no rate) go last in both directions, on PostgreSQL and SQLite alike.
 switch(sort){
  case 'newest':return 'COALESCE(l.published_at,l.created_at) DESC,l.id ASC';
  case 'priceAsc':return `CASE WHEN ${price} IS NULL THEN 1 ELSE 0 END,${price} ASC,l.id ASC`;
  case 'priceDesc':return `CASE WHEN ${price} IS NULL THEN 1 ELSE 0 END,${price} DESC,l.id ASC`;
  case 'area':return 'l.gross_area DESC,l.id ASC';
  default:return 'l.featured DESC,l.created_at DESC';
 }
}
export function compareListings(sort:ListingSort,rates:Record<string,number>={TRY:1}){
 const value=(l:Sortable)=>tlPrice(l,rates),date=(l:Sortable)=>l.publishedAt||l.createdAt||'';
 const byPrice=(a:Sortable,b:Sortable,direction:number)=>{const x=value(a),y=value(b);if(x===undefined||y===undefined)return x===y?0:x===undefined?1:-1;return direction*(x-y);};
 return (a:Sortable,b:Sortable)=>{
  const order=sort==='priceAsc'?byPrice(a,b,1):sort==='priceDesc'?byPrice(a,b,-1):sort==='area'?b.grossArea-a.grossArea:sort==='newest'?date(b).localeCompare(date(a)):Number(Boolean(b.featured))-Number(Boolean(a.featured));
  return order||(sort==='new'?0:a.id.localeCompare(b.id));
 };
}
