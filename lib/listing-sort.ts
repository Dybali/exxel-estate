import type {ExchangeRates} from './exchange-rates';
export const LISTING_SORTS=['new','newest','priceAsc','priceDesc','area'] as const;
export type ListingSort=typeof LISTING_SORTS[number];
type Sortable={id:string;price:number;currency:string;grossArea:number;featured?:boolean;createdAt?:string;publishedAt?:string};
export const listingSort=(value:string|null):ListingSort=>(LISTING_SORTS as readonly string[]).includes(value||'')?value as ListingSort:'new';
// Sorts that ignore the featured flag and need demo and customer listings merged in one order.
export const strictSort=(sort:ListingSort)=>sort!=='new';
export const priceSort=(sort:ListingSort)=>sort==='priceAsc'||sort==='priceDesc';
// TRY value of one unit of each listing currency (CURRENCIES); null when any of them is missing.
export function tryRates(rates:ExchangeRates|null){
 if(!rates)return null;
 const table:Record<string,number>={TRY:1,EUR:rates.eurTry,USD:rates.usdTry,GBP:rates.gbpTry??NaN};
 return Object.values(table).every(n=>Number.isFinite(n)&&n>0)?table:null;
}
// Rates are numbers parsed from the ECB feed and validated above, so they are written into the SQL as literals.
function tryPriceSql(rates:Record<string,number>){
 return `(l.price*CASE l.currency ${Object.entries(rates).filter(([code])=>code!=='TRY').map(([code,rate])=>`WHEN '${code}' THEN ${Number(rate).toFixed(6)}`).join(' ')} ELSE 1 END)`;
}
export function listingOrderSql(sort:ListingSort,rates:Record<string,number>|null){
 const price=rates?tryPriceSql(rates):'l.price';
 switch(sort){
  case 'newest':return 'COALESCE(l.published_at,l.created_at) DESC,l.id ASC';
  case 'priceAsc':return `${price} ASC,l.id ASC`;
  case 'priceDesc':return `${price} DESC,l.id ASC`;
  case 'area':return 'l.gross_area DESC,l.id ASC';
  default:return 'l.featured DESC,l.created_at DESC';
 }
}
export function compareListings(sort:ListingSort,rates:Record<string,number>|null){
 const value=(l:Sortable)=>l.price*(rates?.[l.currency]??1),date=(l:Sortable)=>l.publishedAt||l.createdAt||'';
 return (a:Sortable,b:Sortable)=>{
  const order=sort==='priceAsc'?value(a)-value(b):sort==='priceDesc'?value(b)-value(a):sort==='area'?b.grossArea-a.grossArea:sort==='newest'?date(b).localeCompare(date(a)):Number(Boolean(b.featured))-Number(Boolean(a.featured));
  return order||(sort==='new'?0:a.id.localeCompare(b.id));
 };
}
