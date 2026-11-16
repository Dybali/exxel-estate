import { HomePage } from "@/components/HomePage";
import { featuredFirst } from "@/lib/listings";
import { publicListingSearch } from "@/lib/listing-search-server";

export const dynamic = "force-dynamic";

// The featured listings are read on the server and streamed into the page (search engines see the listing
// links) without holding back the rest of the home page; null lets the browser load them itself.
export default function Home() {
  const featured = Promise.resolve()
    .then(() => publicListingSearch(new URLSearchParams("page=1")))
    .then((result) => featuredFirst(result.listings))
    .catch(() => null);
  return <HomePage featured={featured}/>;
}
