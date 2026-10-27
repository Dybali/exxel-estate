import {ECB_DAILY_XML,parseEcbDaily,type ExchangeRates} from '@/lib/exchange-rates';

let cached: {until:number;value:ExchangeRates}|null = null;

export async function GET() {
  if (cached && cached.until > Date.now()) {
    return Response.json(cached.value,{headers:{'Cache-Control':'public, max-age=300, s-maxage=1800','X-Content-Type-Options':'nosniff'}});
  }
  try {
    const response = await fetch(ECB_DAILY_XML,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('ECB unavailable');
    const xml = await response.text();
    const value = parseEcbDaily(xml);
    cached = {until:Date.now()+30*60_000,value};
    return Response.json(value,{headers:{'Cache-Control':'public, max-age=300, s-maxage=1800','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'rates_unavailable'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
