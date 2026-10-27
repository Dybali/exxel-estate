import { DEMO_LISTINGS, type Listing } from "./listings";
export async function publishedListingEntries():Promise<{id:string;updatedAt:string}[]>{const base=process.env.API_BASE_URL?.replace(/\/$/,'');if(!base)return [];const response=await fetch(base+'/api/sitemap',{cache:'no-store'});if(!response.ok)throw Error('Public listing sitemap could not be loaded');const data=await response.json() as {listings:{id:string;updatedAt:string}[]};return data.listings;}

export async function listingById(id: string): Promise<Listing | null> {
  const demo = DEMO_LISTINGS.find((item) => item.id === id);
  if (demo) return demo;
  const base = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!base || !/^[a-f0-9-]{36}$/i.test(id)) return null;
  try {
    const response = await fetch(`${base}/api/listings/${id}`, { next: { revalidate: 30 } });
    if (!response.ok) return null;
    const data = await response.json() as { listing?: Listing };
    return data.listing || null;
  } catch { return null; }
}
