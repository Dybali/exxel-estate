import records from "@/data/demo-companies.json";
import {SAMPLE_DEVELOPERS} from './developer-showcase';
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

// Only the explicitly requested, labeled developer showcase is public.
// Archived listing fixtures and seller accounts remain unpublished.
export const PUBLIC_DEMO_COMPANIES: Company[] = SAMPLE_DEVELOPERS;
