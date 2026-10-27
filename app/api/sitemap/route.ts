import {publishedListingEntries} from '@/lib/server';
export async function GET(){return Response.json({listings:await publishedListingEntries()},{headers:{'Cache-Control':'public,max-age=60'}});}
