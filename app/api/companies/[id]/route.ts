import {teamDB} from '@/lib/company-team-server';
import {companyProfileDB} from '@/lib/company-profile-server';
import {publicListing} from '@/lib/listings';
import {ensureProfiles} from '@/lib/seller-profiles';
import { db, error, ok, parseListing } from "@/lib/server";
import { PUBLIC_DEMO_COMPANIES as DEMO_COMPANIES } from "@/lib/demo-companies";
import { PUBLIC_DEMO_LISTINGS } from "@/lib/listings";

type CompanyRow = { id: string; owner_id: string; name: string; category: string; created_at: string; bio:string|null;avatar_url:string|null;city:string|null;description:string|null };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return error("Şirket bulunamadı.", 404);
  const featured=new URL(request.url).searchParams.get('featured')==='1';
  const sample = DEMO_COMPANIES.find((company) => company.id === id);
  if (sample) return ok({ company: sample, listings: PUBLIC_DEMO_LISTINGS.filter((listing) => sample.listingIds?.includes(listing.id)&&(!featured||listing.featured)), page: 1, pageSize: 24 }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } });
  const page = Math.min(1000, Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1));
  const pageSize = 24;
  await ensureProfiles(db());await companyProfileDB();await teamDB();
  const company = await db().prepare("SELECT a.id,a.owner_id,a.name,a.category,a.created_at,u.avatar_url,p.bio,c.city,c.description FROM agencies a JOIN users u ON u.id=a.owner_id LEFT JOIN seller_profiles p ON p.user_id=u.id LEFT JOIN company_profiles c ON c.user_id=CAST(u.id AS TEXT) WHERE a.id=? AND a.status='approved' AND u.role='agent' AND u.agent_status='approved'").bind(id).first<CompanyRow>();
  if (!company) return error("Şirket bulunamadı.", 404);
  const [rows, counts, team] = await Promise.all([
    db().prepare(`SELECT l.*,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE ((l.owner_id=? AND l.agency_id IS NULL) OR l.agency_id=?) AND l.status='published' ${featured?'AND EXISTS(SELECT 1 FROM company_featured_listings cf WHERE cf.listing_id=l.id AND cf.agency_id=?)':''} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).bind(company.owner_id, company.id, ...(featured?[company.id]:[]), pageSize, (page - 1) * pageSize).all<Record<string, unknown>>(),
    db().prepare(`SELECT COUNT(*) AS listing_count, SUM(CASE WHEN purpose='satilik' THEN 1 ELSE 0 END) AS sale_count, SUM(CASE WHEN purpose='kiralik' THEN 1 ELSE 0 END) AS rent_count FROM listings WHERE ((owner_id=? AND agency_id IS NULL) OR agency_id=?) AND status='published' ${featured?'AND EXISTS(SELECT 1 FROM company_featured_listings cf WHERE cf.listing_id=listings.id AND cf.agency_id=?)':''}`).bind(company.owner_id,company.id,...(featured?[company.id]:[])).first<{ listing_count: number; sale_count: number | null; rent_count: number | null }>(),
    db().prepare(`SELECT u.id,u.name,u.avatar_url,COUNT(l.id) AS listing_count FROM company_team_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN listings l ON l.owner_id=u.id AND l.agency_id=m.agency_id AND l.status='published' WHERE m.agency_id=? AND m.ended_at IS NULL GROUP BY u.id,u.name,u.avatar_url ORDER BY u.name`).bind(company.id).all(),
  ]);
  const listings = (rows.results || []).map((row:Record<string,unknown>)=>publicListing(parseListing(row)));
  return ok({ company: { id: company.id, ownerId:company.owner_id,city:company.city||undefined,description:company.description||company.bio||"",avatarUrl:company.avatar_url,name: company.name, category: company.category, listingCount: Number(counts?.listing_count || 0), saleCount: Number(counts?.sale_count || 0), rentCount: Number(counts?.rent_count || 0) }, listings, team:team.results, page, pageSize }, {
    headers: { "Cache-Control": "no-store" },
  });
}
