import {latestExchangeRates} from '@/lib/exchange-rates';
// Always rendered per request (live data); the standard Next.js build must not prerender it.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await latestExchangeRates(),{headers:{'Cache-Control':'public, max-age=300, s-maxage=1800','X-Content-Type-Options':'nosniff'}});
  } catch {
    return Response.json({error:'rates_unavailable'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
}
