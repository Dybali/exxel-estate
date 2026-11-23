import {PRICE_DROP_SQL} from "@/lib/price-history";
import {publicListing} from '@/lib/listings';
import {db,error,ok,parseListing,OWNER_VERIFIED_SQL} from "@/lib/server";
import {ensureProfiles,OFFICE_LISTINGS_SQL,profileOffice,profilePage,TEAM_CONSULTANT_SQL} from '@/lib/seller-profiles';
// GET /api/profiles/<id>?page=&liste=ofis: a seller's public profile and listings. With liste=ofis the listings are
// those of the office the seller works for (owner and active team members), the second tab on /profil/<id>.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return error('Profil bulunamadı.',404);
 const database=db();await ensureProfiles(database);
 const select=`SELECT u.id,u.name,u.role,u.agent_status,u.company,u.avatar_url,u.created_at,p.bio,a.id AS agency_id,a.name AS agency_name,a.category,a.status AS agency_status FROM users u LEFT JOIN seller_profiles p ON p.user_id=u.id LEFT JOIN agencies a ON a.owner_id=u.id WHERE u.id=?`;
 const seller=await database.prepare(`${select} AND u.role IN ('individual','agent','admin')`).bind(id).first<Record<string,unknown>>()
  ||await database.prepare(`${select} AND ${TEAM_CONSULTANT_SQL}`).bind(id).first<Record<string,unknown>>().catch(()=>null);
 if(!seller)return error('Profil bulunamadı.',404);
 const url=new URL(request.url),page=profilePage(url.searchParams.get('page')),pageSize=12;
 const office=await profileOffice(database,id);
 const officeView=url.searchParams.get('liste')==='ofis'&&Boolean(office);
 const where=officeView?OFFICE_LISTINGS_SQL:'l.owner_id=?',whereValues=officeView&&office?[office.ownerId,office.id]:[id];
 const countSql=(scope:string)=>`SELECT COUNT(*) AS total,SUM(CASE WHEN l.purpose='satilik' THEN 1 ELSE 0 END) AS sales,SUM(CASE WHEN l.purpose='kiralik' THEN 1 ELSE 0 END) AS rentals FROM listings l WHERE ${scope} AND l.status='published'`;
 const [rows,counts,officeCount]=await Promise.all([
  database.prepare(`SELECT l.*,u.name AS owner_name,${OWNER_VERIFIED_SQL},${PRICE_DROP_SQL} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where} AND l.status='published' ORDER BY l.created_at DESC,l.id DESC LIMIT ? OFFSET ?`).bind(...whereValues,pageSize,(page-1)*pageSize).all<Record<string,unknown>>(),
  database.prepare(countSql('l.owner_id=?')).bind(id).first<Record<string,unknown>>(),
  office?database.prepare(countSql(OFFICE_LISTINGS_SQL)).bind(office.ownerId,office.id).first<Record<string,unknown>>().catch(()=>null):Promise.resolve(null),
 ]);
 const company=office?.name||(seller.role==='agent'?String(seller.agency_name||seller.company||''):null);
 // Taşınmaz Ticareti Yetki Belgesi of an approved office (lib/office-check.ts): number, TTBS confirmation date.
 let licence:{number:string;ttbsCheckedAt:string|null}|null=null;
 if(seller.role==='agent'&&seller.agent_status==='approved'){try{const row=await database.prepare("SELECT v.document_number,c.ttbs_checked_at FROM office_verifications v LEFT JOIN office_checks c ON c.user_id=v.user_id AND c.document_id=v.document_id WHERE v.user_id=? AND v.state='approved'").bind(String(seller.id)).first<{document_number:string;ttbs_checked_at:string|null}>();if(row)licence={number:String(row.document_number),ttbsCheckedAt:row.ttbs_checked_at||null};}catch{const row=await database.prepare("SELECT document_number FROM office_verifications WHERE user_id=? AND state='approved'").bind(String(seller.id)).first<{document_number:string}>().catch(()=>null);if(row)licence={number:String(row.document_number),ttbsCheckedAt:null};}}
 const officeTotal=Number(officeCount?.total||0);
 return ok({profile:{id:seller.id,name:seller.name,company,role:seller.role,category:seller.category,consultant:Boolean(office)&&office?.ownerId!==String(seller.id),office:office?{id:office.id,name:office.name,logo:office.logo,listingCount:officeTotal}:null,agentApproved:seller.role==='agent'&&seller.agent_status==='approved'&&seller.agency_status==='approved',verifiedAgent:rows.results.some((row:Record<string,unknown>)=>Number(row.owner_verified)===1),licence,avatarUrl:seller.avatar_url||null,bio:seller.bio||'',memberSince:seller.created_at,listingCount:Number(counts?.total||0),saleCount:Number(counts?.sales||0),rentCount:Number(counts?.rentals||0)},listings:rows.results.map(row=>publicListing(parseListing(row))),list:officeView?'office':'own',total:officeView?officeTotal:Number(counts?.total||0),page,pageSize},{headers:{'Cache-Control':'no-store'}});
}
