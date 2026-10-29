export const ECB_DAILY_XML = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export type ExchangeRates = {
  date: string;
  eurTry: number;
  usdTry: number;
  eurUsd: number;
  gbpTry?: number;
  chfTry?: number;
  source: 'ECB';
};

export function parseEcbDaily(xml: string, at = Date.now()): ExchangeRates {
  if (xml.length > 100_000) throw new Error('Unexpected exchange-rate response size');
  const date = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  const timestamp = date ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > at + 86_400_000 || at - timestamp > 7 * 86_400_000) {
    throw new Error('Exchange-rate date unavailable');
  }
  const values = new Map<string, number>();
  for (const match of xml.matchAll(/<Cube\b([^>]*\bcurrency=['"][A-Z]{3}['"][^>]*)\/?\s*>/g)) {
    const currency = /\bcurrency=['"]([A-Z]{3})['"]/.exec(match[1])?.[1];
    const value = /\brate=['"]([0-9]+(?:\.[0-9]+)?)['"]/.exec(match[1])?.[1];
    if (currency && value) values.set(currency, Number(value));
  }
  const eurTry = values.get('TRY'), eurUsd = values.get('USD');
  if (!eurTry || !eurUsd || !Number.isFinite(eurTry) || !Number.isFinite(eurUsd) || eurTry <= 0 || eurUsd <= 0) {
    throw new Error('Required exchange rates unavailable');
  }
  const cross=(currency:string)=>{const value=values.get(currency);return value && Number.isFinite(value) && value>0 ? eurTry/value : undefined;};
  return {date: date!, eurTry, usdTry: eurTry / eurUsd, eurUsd, gbpTry:cross('GBP'), chfTry:cross('CHF'), source: 'ECB'};
}

let latest: {until:number;value:ExchangeRates}|null = null;
// ECB daily reference rates, cached in the Worker isolate for 30 minutes.
export async function latestExchangeRates() {
  if (latest && latest.until > Date.now()) return latest.value;
  const response = await fetch(ECB_DAILY_XML,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('ECB unavailable');
  const value = parseEcbDaily(await response.text());
  latest = {until:Date.now()+30*60_000,value};
  return value;
}
