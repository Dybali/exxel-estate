import { Explorer, type ExplorerInitial } from "@/components/Explorer";
import { PageSkeleton } from "@/components/PageSkeleton";
import { initialExplorerQuery } from "@/lib/explorer-query";
import { publicListingSearch } from "@/lib/listing-search-server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The first page of results is rendered on the server (search engines see the listing links); the Explorer
// takes over in the browser for filter changes, more results and the map. Without a database, a bad price
// range or a missing exchange rate the Explorer loads the results itself, as before.
async function firstPage(searchParams: Props["searchParams"]): Promise<ExplorerInitial | undefined> {
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) { const one = Array.isArray(value) ? value[0] : value; if (one !== undefined) params.set(key, one); }
    const query = initialExplorerQuery(params), search = new URLSearchParams(query);
    search.set("page", "1");
    return { query, result: await publicListingSearch(search) };
  } catch {
    return undefined;
  }
}

export default async function ListingsPage({ searchParams }: Props) {
  const initial = await firstPage(searchParams);
  return <Suspense fallback={<PageSkeleton variant="listings"/>}><Explorer initial={initial}/></Suspense>;
}
