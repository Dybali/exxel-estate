import { AdminListingReview } from "@/components/AdminListingReview";

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminListingReview listingId={id}/>;
}
