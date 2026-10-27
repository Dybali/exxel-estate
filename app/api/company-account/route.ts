import {body,currentUser,error,now,ok,sameOrigin,str} from '@/lib/server';
import {companyProfileDB} from '@/lib/company-profile-server';
import {companyWebsite} from '@/lib/company-membership';
import {CITIES} from '@/lib/listings';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
  const user=await currentUser(request);if(!user)return error('Giriş yapın.',401);if(user.role!=='agent')return error('Şirket hesabı gerekli.',403);
  const database=await companyProfileDB();
  const company=await database.prepare('SELECT id,name,category,status FROM agencies WHERE owner_id=?').bind(user.id).first();
  const profile=await database.prepare('SELECT city,website,address,description,version FROM company_profiles WHERE user_id=?').bind(user.id).first();
  return ok({company,profile},{headers});
}
export async function POST(request:Request){
  if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
  const user=await currentUser(request);if(!user)return error('Giriş yapın.',401);if(user.role!=='agent'||!user.email_verified)return error('E-postası doğrulanmış şirket hesabı gerekli.',403);
  let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
  const city=str(data.city,80),address=str(data.address,501),description=str(data.description,2001),version=Number(data.version);
  if(!CITIES.includes(city)||address.length>500||description.length>2000||!Number.isSafeInteger(version)||version<0)return error('Şehir ve firma bilgilerini kontrol edin.');
  let website:string;try{website=companyWebsite(data.website);}catch(e){return error((e as Error).message);}
  const database=await companyProfileDB();
  if(!await database.prepare('SELECT id FROM agencies WHERE owner_id=?').bind(user.id).first())return error('Önce şirket başvurunuzu tamamlayın.',409);
  const profile=await database.prepare(`INSERT INTO company_profiles(user_id,city,website,address,description,version,updated_at) VALUES(?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET city=excluded.city,website=excluded.website,address=excluded.address,description=excluded.description,version=company_profiles.version+1,updated_at=excluded.updated_at WHERE company_profiles.version=? RETURNING city,website,address,description,version`).bind(user.id,city,website,address,description,now(),version).first();
  if(!profile)return error('Bilgiler başka bir oturumda değişti. Sayfayı yenileyin.',409);
  return ok({profile},{headers});
}
