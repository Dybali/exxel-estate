import records from "@/data/demo-companies.json";
import type { Company } from "./companies";

export const DEMO_COMPANIES: Company[] = records.map((record) => ({
  id: record.id,
  name: record.name,
  category: record.category as Company["category"],
  city: record.city,
  description: record.description,
  listingIds: record.listingIds,
  listingCount: record.listingIds.length,
  saleCount: record.saleCount,
  rentCount: record.rentCount,
  sample: true,
}));
