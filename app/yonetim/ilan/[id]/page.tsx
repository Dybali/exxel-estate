import {adminPageUser} from "@/lib/admin-page";
import { AdminListingReview } from "@/components/AdminListingReview";

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await adminPageUser("/yonetim/ilan/"+id);
  return <AdminListingReview listingId={id}/>;
}
