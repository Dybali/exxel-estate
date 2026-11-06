import {currentRates} from '@/lib/tcmb-server';
// TCMB indicative rates (lib/tcmb.ts) for the currency bar and the display currency of listing
// prices; open pages re-read this every 15 minutes. Always rendered per request (live data).
export const dynamic = "force-dynamic";

export async function GET() {
  const rates = await currentRates();
  if (!rates) return Response.json({error:'rates_unavailable'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  // Short browser/edge caching: the server itself re-checks TCMB at most every 15 minutes.
  return Response.json(rates,{headers:{'Cache-Control':rates.stale?'no-store':'public, max-age=300, s-maxage=300','X-Content-Type-Options':'nosniff'}});
}
