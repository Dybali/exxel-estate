export type Company = {
  id: string;
  ownerId?:string;
  avatarUrl?:string|null;
  name: string;
  category: "agency" | "developer";
  listingCount: number;
  saleCount: number;
  rentCount: number;
  sample?: boolean;
  city?: string;
  description?: string;
  listingIds?: string[];
};
