export type Company = {
  id: string;
  name: string;
  category: "agency" | "developer";
  listingCount: number;
  saleCount: number;
  rentCount: number;
};
