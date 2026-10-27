export const CURRENCIES=['TRY','EUR','USD','GBP'] as const;
export function priceCurrency(query:{get:(key:string)=>string|null}){
 const currency=query.get('currency');
 if(currency&&!(CURRENCIES as readonly string[]).includes(currency))throw new Error('Geçersiz para birimi.');
 return currency||((query.get('minPrice')||query.get('maxPrice')||['priceAsc','priceDesc'].includes(query.get('sort')||''))?'TRY':'');
}
