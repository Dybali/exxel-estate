import {PRICE_DROP_SQL} from "@/lib/price-history";
import {publicListing} from '@/lib/listings';
import {db,error,ok,parseListing,OWNER_VERIFIED_SQL} from "@/lib/server";
import {ensureProfiles,profilePage} from '@/lib/seller-profiles';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return error('Profil bulunamadı.',404);
 const database=db();await ensureProfiles(database);
 const seller=await database.prepare(`SELECT u.id,u.name,u.role,u.agent_status,u.company,u.avatar_url,u.created_at,p.bio,a.id AS agency_id,a.name AS agency_name,a.category,a.status AS agency_status FROM users u LEFT JOIN seller_profiles p ON p.user_id=u.id LEFT JOIN agencies a ON a.owner_id=u.id WHERE u.id=? AND u.role IN ('individual','agent','admin')`).bind(id).first<Record<string,unknown>>();
 if(!seller)return error('Profil bulunamadı.',404);
 const page=profilePage(new URL(request.url).searchParams.get('page')),pageSize=12;
 const [rows,counts]=await Promise.all([database.prepare(`SELECT l.*,u.name AS owner_name,${OWNER_VERIFIED_SQL},${PRICE_DROP_SQL} FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.owner_id=? AND l.status='published' ORDER BY l.created_at DESC,l.id DESC LIMIT ? OFFSET ?`).bind(id,pageSize,(page-1)*pageSize).all<Record<string,unknown>>(),database.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN purpose='satilik' THEN 1 ELSE 0 END) AS sales,SUM(CASE WHEN purpose='kiralik' THEN 1 ELSE 0 END) AS rentals FROM listings WHERE owner_id=? AND status='published'`).bind(id).first<Record<string,unknown>>()]);
 const company=seller.role==='agent'?String(seller.agency_name||seller.company||''):null;
 return ok({profile:{id:seller.id,name:seller.name,company,role:seller.role,category:seller.category,agentApproved:seller.role==='agent'&&seller.agent_status==='approved'&&seller.agency_status==='approved',verifiedAgent:rows.results.some((row:Record<string,unknown>)=>Number(row.owner_verified)===1),avatarUrl:seller.avatar_url||null,bio:seller.bio||'',memberSince:seller.created_at,listingCount:Number(counts?.total||0),saleCount:Number(counts?.sales||0),rentCount:Number(counts?.rentals||0)},listings:rows.results.map(row=>publicListing(parseListing(row))),page,pageSize},{headers:{'Cache-Control':'no-store'}});
}
