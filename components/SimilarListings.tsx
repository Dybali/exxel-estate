import { ArrowRight } from "lucide-react";
import Link from "@/components/SafeLink";
import { ListingCard } from "@/components/ListingCard";
import { T } from "@/lib/i18n";
import type { Listing } from "@/lib/listings";

/** "Benzer ilanlar" at the bottom of the listing page (lib/similar-listings.ts); nothing when empty. */
export function SimilarListings({ listings, href }: { listings: Listing[]; href: string }) {
  if (!listings.length) return null;
  return <section className="similar-listings" aria-labelledby="similar-listings-heading">
    <div className="market-section-head similar-listings-head">
      <div><span className="market-overline">ESTATEMARKET24</span><h2 id="similar-listings-heading"><T id="Benzer ilanlar"/></h2><p><T id="Aynı türde, yakın fiyatlı ve mümkünse aynı bölgedeki ilanlar."/></p></div>
      <Link href={href} className="btn btn-secondary btn-sm similar-listings-more"><T id="Tümünü gör"/><ArrowRight size={16} aria-hidden="true"/></Link>
    </div>
    <div className="market-feature-grid similar-listings-grid" data-count={listings.length}>{listings.map((item) => <ListingCard key={item.id} listing={item}/>)}</div>
  </section>;
}
