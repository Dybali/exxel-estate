import {publicListing} from "@/lib/listings";
import {db,OWNER_VERIFIED_SQL,parseListing} from "@/lib/server";
import {currentRates} from "@/lib/tcmb-server";
import {searchListings,type ListingSearchDatabase} from "@/lib/listing-search";

/** The public listing search (lib/listing-search.ts) against the main database. */
export function publicListingSearch(q:URLSearchParams){
  return searchListings(q,{db:db() as unknown as ListingSearchDatabase,parse:(row)=>publicListing(parseListing(row)),ownerColumns:OWNER_VERIFIED_SQL,loadRates:currentRates});
}
