export const CURRENCIES=['TRY','EUR','USD','GBP'] as const;
export function priceCurrency(query:{get:(key:string)=>string|null}){
 const currency=query.get('currency');
 if(currency&&!(CURRENCIES as readonly string[]).includes(currency))throw new Error('Geçersiz para birimi.');
 // A price range needs one currency; price sorting converts currencies instead (see lib/listing-sort.ts).
 return currency||(query.get('minPrice')||query.get('maxPrice')?'TRY':'');
}
