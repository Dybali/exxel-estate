import type {ExchangeRates} from './exchange-rates';

// Visitors can see an approximate price in another currency next to the listing's own price.
// The listing price always stays primary; conversions use the daily rates from /api/exchange-rates.
export const DISPLAY_CURRENCIES=['TRY','EUR','USD','GBP'] as const;
export type DisplayCurrency=typeof DISPLAY_CURRENCIES[number];
// "off" is an explicit visitor choice to show no conversion.
export type DisplayChoice=DisplayCurrency|'off';
export const DISPLAY_CURRENCY_KEY='em24:display-currency';

// Default until the visitor chooses: Turkish visitors see prices as listed (most listings are in TRY);
// German, French and Dutch visitors see euros; English, Arabic, Persian and Russian visitors see
// US dollars, the reference currency for foreign buyers in Türkiye (and for the citizenship threshold).
const LOCALE_DEFAULTS:Record<string,DisplayChoice>={tr:'off',de:'EUR',fr:'EUR',nl:'EUR',en:'USD',ar:'USD',fa:'USD',ru:'USD'};
export const defaultDisplayCurrency=(locale:string):DisplayChoice=>LOCALE_DEFAULTS[locale]||'off';
export const isDisplayChoice=(value:unknown):value is DisplayChoice=>value==='off'||(DISPLAY_CURRENCIES as readonly unknown[]).includes(value);

// Turkish lira per unit of the currency, or undefined when the rate is missing.
export function tryPerUnit(currency:string,rates:Pick<ExchangeRates,'eurTry'|'usdTry'|'gbpTry'>){
 const rate=currency==='TRY'?1:currency==='EUR'?rates.eurTry:currency==='USD'?rates.usdTry:currency==='GBP'?rates.gbpTry:undefined;
 return typeof rate==='number'&&Number.isFinite(rate)&&rate>0?rate:undefined;
}

// Converts through Turkish lira; null when no conversion is needed or possible.
export function convertPrice(value:number,from:string,to:DisplayChoice,rates:Pick<ExchangeRates,'eurTry'|'usdTry'|'gbpTry'>|null){
 if(!rates||to==='off'||from===to||!Number.isFinite(value)||value<=0)return null;
 const source=tryPerUnit(from,rates),target=tryPerUnit(to,rates);
 if(!source||!target)return null;
 return value*source/target;
}

// Rounded to keep the figure clearly approximate: 3 significant digits below 1 million, else thousands.
export function roundApprox(value:number){
 if(value>=1_000_000)return Math.round(value/1000)*1000;
 const step=10**Math.max(0,Math.floor(Math.log10(value))-2);
 return Math.round(value/step)*step;
}
