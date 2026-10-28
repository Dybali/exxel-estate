import {companyProfileDB} from '@/lib/company-profile-server';
import {officeDB} from '@/lib/office-verification-server';
import {reportsDB} from '@/lib/reports-server';
import {ensureProfiles} from '@/lib/seller-profiles';
import { ensureMessagingSchema, type ChatDatabase } from "@/lib/messaging-service";
import { currentUser, db, error, isAdmin, ok } from "@/lib/server";
import { DEMO_LISTINGS } from "@/lib/listings";
export async function GET(request:Request) {
  const user=await currentUser(request);if(!user?.email_verified||!isAdmin(user))return error("Yönetici yetkisi gerekli.",403);
  await ensureMessagingSchema(db() as unknown as ChatDatabase);
  await ensureProfiles(db());
  await reportsDB();await officeDB();
  const params=new URL(request.url).searchParams;
  const table=params.get("table");
  await companyProfileDB();
  const selections:Record<string,string>={officeApplicationDetails:"SELECT * FROM office_application_details",companyProfiles:"SELECT * FROM company_profiles",officeVerifications:"SELECT * FROM office_verifications",moderationHolds:"SELECT * FROM listing_moderation_holds",listingReports:"SELECT * FROM listing_reports",reportEvents:"SELECT * FROM listing_report_events",appointments:"SELECT * FROM appointments",adminAudit:"SELECT * FROM admin_audit",listingDrafts:"SELECT * FROM listing_drafts",sellerProfiles:"SELECT * FROM seller_profiles",users:"SELECT id,email,email_verified,name,phone,whatsapp_enabled,avatar_url,role,agent_status,company,created_at FROM users",oauthAccounts:"SELECT provider,provider_user_id,user_id,created_at FROM oauth_accounts",agencies:"SELECT * FROM agencies",listings:"SELECT * FROM listings",propertyImages:"SELECT * FROM property_images",favorites:"SELECT * FROM favorites",messages:"SELECT * FROM messages",messageReceipts:"SELECT * FROM message_receipts",packages:"SELECT * FROM packages",purchases:"SELECT * FROM purchases",countrySettings:"SELECT * FROM country_settings",savedSearches:"SELECT * FROM saved_searches",discoveryPreferences:"SELECT * FROM discovery_preferences",priceHistory:"SELECT * FROM price_history"};
  if(table){
    if(!selections[table])return error("Geçersiz tablo.");
    const offset=Math.max(0,Math.floor(Number(params.get("offset"))||0));
    const rows=await db().prepare(`${selections[table]} LIMIT 500 OFFSET ?`).bind(offset).all();
    return ok({format:"exxel-estate-v1",table,offset,nextOffset:(rows.results||[]).length===500?offset+500:null,records:rows.results||[]},{headers:{"Cache-Control":"no-store"}});
  }
  const [users,oauthAccounts,agencies,listings,propertyImages,favorites,messages,messageReceipts,packages,purchases,countrySettings,savedSearches,discoveryPreferences,priceHistory,sellerProfiles,listingDrafts,adminAudit,appointments,listingReports,reportEvents,moderationHolds]=await Promise.all([
    db().prepare("SELECT id,email,email_verified,name,phone,whatsapp_enabled,role,agent_status,company,created_at FROM users").all(),
    db().prepare("SELECT provider,provider_user_id,user_id,created_at FROM oauth_accounts").all(),
    db().prepare("SELECT * FROM agencies").all(),
    db().prepare("SELECT * FROM listings").all(),
    db().prepare("SELECT * FROM property_images").all(),
    db().prepare("SELECT * FROM favorites").all(),
    db().prepare("SELECT * FROM messages").all(),
    db().prepare("SELECT * FROM message_receipts").all(),
    db().prepare("SELECT * FROM packages").all(),
    db().prepare("SELECT * FROM purchases").all(),
    db().prepare("SELECT * FROM country_settings").all(),
    db().prepare("SELECT * FROM saved_searches").all(),
    db().prepare("SELECT * FROM discovery_preferences").all(),
    db().prepare("SELECT * FROM price_history").all(),
    db().prepare("SELECT * FROM seller_profiles").all(),
    db().prepare("SELECT * FROM listing_drafts").all(),
    db().prepare("SELECT * FROM admin_audit").all(),
    db().prepare("SELECT * FROM appointments").all(),
    db().prepare("SELECT * FROM listing_reports").all(),
    db().prepare("SELECT * FROM listing_report_events").all(),
    db().prepare("SELECT * FROM listing_moderation_holds").all()
  ]);
  const companyProfiles=await db().prepare("SELECT * FROM company_profiles").all();
  const officeVerifications=await db().prepare("SELECT * FROM office_verifications").all();
  const officeApplicationDetails=await db().prepare("SELECT * FROM office_application_details").all();
  const payload={officeApplicationDetails:officeApplicationDetails.results,companyProfiles:companyProfiles.results,officeVerifications:officeVerifications.results,format:"exxel-estate-v2",exportedAt:new Date().toISOString(),users:users.results,oauthAccounts:oauthAccounts.results,agencies:agencies.results,listings:listings.results,propertyImages:propertyImages.results,favorites:favorites.results,messages:messages.results,messageReceipts:messageReceipts.results,packages:packages.results,purchases:purchases.results,countrySettings:countrySettings.results,savedSearches:savedSearches.results,discoveryPreferences:discoveryPreferences.results,priceHistory:priceHistory.results,sellerProfiles:sellerProfiles.results,listingDrafts:listingDrafts.results,adminAudit:adminAudit.results,appointments:appointments.results,listingReports:listingReports.results,reportEvents:reportEvents.results,moderationHolds:moderationHolds.results,demoListings:DEMO_LISTINGS};
  return ok(payload,{headers:{"Content-Disposition":"attachment; filename=exxel-estate-export.json","Cache-Control":"no-store"}});
}

