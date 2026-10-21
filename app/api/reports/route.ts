import {body,currentUser,error,listingById,now,ok,sameOrigin,RequestInputError} from '@/lib/server';
import {reportsDB} from '@/lib/reports-server';
import {ReportError,reportInput,reportLimit} from '@/lib/report-service';
const noCache={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Bildirimlerinizi görmek için giriş yapın.',401);const database=await reportsDB(),q=new URL(request.url).searchParams,id=q.get('listingId');const page=Math.min(100,Math.max(1,Number(q.get('page'))||1));if(!Number.isInteger(page))return error('Geçersiz sayfa.');
 if(id&&!/^[-a-zA-Z0-9]{1,80}$/.test(id))return error('Geçersiz ilan.');
 const where=id?'reporter_id=? AND listing_id=?':'reporter_id=?',values=id?[user.id,id]:[user.id];
 const rows=await database.prepare(`SELECT id,listing_id,title_snapshot,reason,details,state,resolution,created_at,updated_at,version FROM listing_reports WHERE ${where} ORDER BY created_at DESC LIMIT 20 OFFSET ?`).bind(...values,(page-1)*20).all();return ok({reports:rows.results,page},{headers:noCache});}
export async function POST(request:Request){if(!sameOrigin(request))return error('Geçersiz kaynak.',403);const user=await currentUser(request);if(!user)return error('İlan bildirmek için giriş yapın.',401);if(!user.email_verified)return error('Önce e-posta adresinizi doğrulayın.',403);
 try{const input=reportInput(await body(request)),database=await reportsDB();const existing=await database.prepare('SELECT id,state FROM listing_reports WHERE listing_id=? AND reporter_id=?').bind(input.listingId,user.id).first();if(existing)return ok({report:existing,duplicate:true},{headers:noCache});
 const listing=await listingById(input.listingId);if(!listing||listing.status!=='published')return error('Yayında olan ilan bulunamadı.',404);if(listing.ownerId===user.id)return error('Kendi ilanınızı bildiremezsiniz. İlan düzenleme ekranını kullanın.');
 await reportLimit(database,user.id);const id=crypto.randomUUID(),stamp=now();
 await database.prepare("INSERT INTO listing_reports(id,listing_id,reporter_id,title_snapshot,reason,details,state,created_at,updated_at) VALUES(?,?,?,?,?,?,'open',?,?) ON CONFLICT(listing_id,reporter_id) DO NOTHING").bind(id,listing.id,user.id,listing.title,input.reason,input.details,stamp,stamp).run();
 const saved=await database.prepare('SELECT id,state FROM listing_reports WHERE listing_id=? AND reporter_id=?').bind(listing.id,user.id).first<{id:string;state:string}>();return ok({report:saved,duplicate:saved?.id!==id},{status:saved?.id===id?201:200,headers:noCache});
 }catch(cause){if(cause instanceof RequestInputError)return error(cause.message,400);if(cause instanceof ReportError)return error(cause.message,cause.status);console.error('report-create failed');return error('Bildirim kaydedilemedi. Daha sonra tekrar deneyin.',500);}}
