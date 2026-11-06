import type {RateSnapshot} from './tcmb';
import {tlPerUnit} from './tcmb';
/** Listing prices are entered and stored only in Turkish lira. */
export const LISTING_CURRENCY='TRY';
/** Currencies of listings entered before TL-only entry; still read, never accepted for new prices. */
export const LEGACY_CURRENCIES=['EUR','USD','GBP'] as const;
/** Every currency a stored listing row can have (market statistics, legacy rows). */
export const CURRENCIES=['TRY',...LEGACY_CURRENCIES] as const;
export const TL_ONLY_MESSAGE='İlan fiyatı yalnızca Türk lirası (TL) olarak girilebilir.';
/** Accepts a missing currency or TRY/TL for a new or edited listing price; anything else is rejected. */
export const listingCurrencyAllowed=(value:unknown)=>value==null||value===''||(typeof value==='string'&&['TRY','TL'].includes(value.trim().toUpperCase()));

// Currency of a price range (minPrice/maxPrice): the visitor's display currency. It never filters
// listings by their own currency; the range is converted to TL and compared with the TL base price.
const RANGE_CURRENCY=/^[A-Z]{3}$/;
export function priceCurrency(query:{get:(key:string)=>string|null}){
 const currency=query.get('currency');
 if(currency&&!RANGE_CURRENCY.test(currency))throw new Error('Geçersiz para birimi.');
 return query.get('minPrice')||query.get('maxPrice')?currency||'TRY':'';
}
/**
 * The range in Turkish lira, converted with the request's TCMB bulletin (min rounded down, max up so
 * a listing at the shown amount stays inside). null when the currency has no rate in the bulletin.
 */
export function tlPriceRange(query:{get:(key:string)=>string|null},rates:RateSnapshot|null){
 const currency=priceCurrency(query)||'TRY',rate=tlPerUnit(currency,rates);
 if(rate===undefined)return null;
 const read=(key:string)=>{const value=query.get(key);return value&&/^\d{1,12}$/.test(value)?Number(value):undefined;};
 const min=read('minPrice'),max=read('maxPrice');
 return {currency,min:min===undefined?undefined:Math.floor(min*rate),max:max===undefined?undefined:Math.ceil(max*rate)};
}
