import {publishedListingEntries} from '@/lib/server';
// Always rendered per request (live data); the standard Next.js build must not prerender it.
export const dynamic = "force-dynamic";
export async function GET(){return Response.json({listings:await publishedListingEntries()},{headers:{'Cache-Control':'public,max-age=60'}});}
