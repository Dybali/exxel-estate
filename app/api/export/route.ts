import { currentUser, db, error, isAdmin, ok } from "@/lib/server";
import { DEMO_LISTINGS } from "@/lib/listings";
export async function GET(request:Request) {
  const user=await currentUser(request);if(!isAdmin(user))return error("Yönetici yetkisi gerekli.",403);
  const params=new URL(request.url).searchParams;
  const table=params.get("table");
  const selections:Record<string,string>={users:"SELECT id,email,email_verified,name,phone,role,agent_status,company,created_at FROM users",oauthAccounts:"SELECT provider,provider_user_id,user_id,created_at FROM oauth_accounts",listings:"SELECT * FROM listings",favorites:"SELECT * FROM favorites",messages:"SELECT * FROM messages",packages:"SELECT * FROM packages",purchases:"SELECT * FROM purchases",countrySettings:"SELECT * FROM country_settings"};
  if(table){
    if(!selections[table])return error("Geçersiz tablo.");
    const offset=Math.max(0,Math.floor(Number(params.get("offset"))||0));
    const rows=await db().prepare(`${selections[table]} LIMIT 500 OFFSET ?`).bind(offset).all();
    return ok({format:"exxel-estate-v1",table,offset,nextOffset:(rows.results||[]).length===500?offset+500:null,records:rows.results||[]},{headers:{"Cache-Control":"no-store"}});
  }
  const [users,oauthAccounts,listings,favorites,messages,packages,purchases,countrySettings]=await Promise.all([
    db().prepare("SELECT id,email,email_verified,name,phone,role,agent_status,company,created_at FROM users").all(),
    db().prepare("SELECT provider,provider_user_id,user_id,created_at FROM oauth_accounts").all(),
    db().prepare("SELECT * FROM listings").all(),
    db().prepare("SELECT * FROM favorites").all(),
    db().prepare("SELECT * FROM messages").all(),
    db().prepare("SELECT * FROM packages").all(),
    db().prepare("SELECT * FROM purchases").all(),
    db().prepare("SELECT * FROM country_settings").all()
  ]);
  const payload={format:"exxel-estate-v1",exportedAt:new Date().toISOString(),users:users.results,oauthAccounts:oauthAccounts.results,listings:listings.results,favorites:favorites.results,messages:messages.results,packages:packages.results,purchases:purchases.results,countrySettings:countrySettings.results,demoListings:DEMO_LISTINGS};
  return ok(payload,{headers:{"Content-Disposition":"attachment; filename=exxel-estate-export.json","Cache-Control":"no-store"}});
}
