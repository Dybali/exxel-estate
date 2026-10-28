import {sql} from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Derived public-content translations live in the Site's durable D1 cache.
export const contentTranslations=sqliteTable('content_translations',{key:text('key').primaryKey(),translatedText:text('translated_text').notNull(),detectedLanguage:text('detected_language'),createdAt:text('created_at').notNull()});
export const translationLeases=sqliteTable('translation_leases',{key:text('key').primaryKey(),token:text('token').notNull(),leaseUntil:integer('lease_until').notNull(),lastError:text('last_error')});
export const translationUsage=sqliteTable('translation_usage',{key:text('key').primaryKey(),characters:integer('characters').notNull().default(0)});

// Aggregate assistant quotas in the Site D1 binding; no chat content is stored.
export const aiUsageLimits=sqliteTable('ai_usage_limits',{
  key:text('key').primaryKey(),requests:integer('requests').notNull().default(0),
  inputTokens:integer('input_tokens').notNull().default(0),outputTokens:integer('output_tokens').notNull().default(0),expiresAt:text('expires_at').notNull(),
},t=>[index('ai_usage_expiry_idx').on(t.expiresAt)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsappEnabled: integer("whatsapp_enabled", { mode: "boolean" }).notNull().default(false),
  role: text("role").notNull().default("buyer"),
  agentStatus: text("agent_status").notNull().default("none"),
  company: text("company"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

export const agencies=sqliteTable("agencies",{id:text("id").primaryKey(),ownerId:text("owner_id").notNull().references(()=>users.id),name:text("name").notNull(),phone:text("phone"),email:text("email"),category:text("category").notNull().default("agency"),status:text("status").notNull().default("pending"),createdAt:text("created_at").notNull()},t=>[uniqueIndex("agencies_owner_unique").on(t.ownerId)]);

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const oauthAccounts = sqliteTable("oauth_accounts", {
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
}, (t) => [
  uniqueIndex("oauth_accounts_provider_user_unique").on(t.provider, t.providerUserId),
  uniqueIndex("oauth_accounts_user_provider_unique").on(t.userId, t.provider),
]);

export const oauthFlows = sqliteTable("oauth_flows", {
  stateHash: text("state_hash").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  role: text("role").notNull(),
  nextPath: text("next_path").notNull(),
  linkUserId: text("link_user_id"),
  expiresAt: text("expires_at").notNull(),
}, (t) => [index("oauth_flows_expiry_idx").on(t.expiresAt)]);

export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
});

export const adminSetup = sqliteTable("admin_setup", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  completedAt: text("completed_at").notNull(),
});

export const listings = sqliteTable("listings", {
 presentation:text("presentation").notNull().default("{}"),
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  purpose: text("purpose").notNull(),
  propertyType: text("property_type").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("TRY"),
  city: text("city").notNull(),
  district: text("district").notNull(),
  neighborhood: text("neighborhood"),
  neighborhoodId: integer("neighborhood_id"),
  postalCode: text("postal_code"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  grossArea: integer("gross_area").notNull(),
  netArea: integer("net_area"),
  rooms: text("rooms"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  buildingAge: integer("building_age"),
  floor: integer("floor"),
  totalFloors: integer("total_floors"),
  heating: text("heating"),
  furnished: integer("furnished", { mode: "boolean" }).notNull().default(false),
  amenities: text("amenities").notNull().default("[]"),
  images: text("images").notNull().default("[]"),
  translations: text("translations").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  expiresAt: text("expires_at"),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  publishedAt: text("published_at"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("listings_search_idx").on(t.status, t.purpose, t.propertyType, t.city, t.price),
  index("listings_location_idx").on(t.status, t.city, t.district),
  index("listings_price_idx").on(t.status, t.price),
  index("listings_recent_idx").on(t.status, t.createdAt),
  index("listings_published_at_idx").on(t.status,t.publishedAt),
  index("listings_area_idx").on(t.grossArea),
  index("listings_owner_idx").on(t.ownerId),
]);

export const propertyImages = sqliteTable("property_images", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull().references(() => listings.id, {onDelete:"cascade"}),
  storageProvider: text("storage_provider").notNull().default("r2"),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  checksumSha256: text("checksum_sha256"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: text("created_at").notNull(),
}, (t)=>[uniqueIndex("property_images_object_key_unique").on(t.objectKey),index("property_images_property_idx").on(t.propertyId,t.sortOrder)]);

export const favorites = sqliteTable("favorites", {
  userId: text("user_id").notNull().references(() => users.id),
  listingId: text("listing_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("favorites_pair_unique").on(t.userId, t.listingId)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  senderId: text("sender_id").notNull().references(() => users.id),
  recipientId: text("recipient_id"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("messages_recipient_idx").on(t.recipientId, t.createdAt),
  index("messages_sender_idx").on(t.senderId, t.createdAt),
  index("messages_thread_idx").on(t.listingId, t.senderId, t.recipientId, t.createdAt),
]);

export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  listingLimit: integer("listing_limit").notNull(),
  durationDays: integer("duration_days").notNull(),
  featuredDays: integer("featured_days").notNull().default(0),
  price: integer("price").notNull(),
  currency: text("currency").notNull().default("TRY"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  packageId: text("package_id").notNull().references(() => packages.id),
  status: text("status").notNull().default("pending"),
  providerRef: text("provider_ref"),
  createdAt: text("created_at").notNull(),
});

export const countrySettings = sqliteTable("country_settings", {
  countryCode: text("country_code").primaryKey(),
  locale: text("locale").notNull(),
  legalText: text("legal_text").notNull().default(""),
  paymentProvider: text("payment_provider"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
});

export const messageReceipts = sqliteTable("message_receipts", {
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: text("read_at").notNull(),
}, (t) => [primaryKey({ columns: [t.messageId, t.userId] })]);

export const savedSearches = sqliteTable("saved_searches", {
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),name:text("name").notNull(),query:text("query").notNull(),enabled:integer("enabled").notNull().default(1),createdAt:text("created_at").notNull(),seenAt:text("seen_at").notNull(),
},t=>[uniqueIndex("saved_searches_pair_unique").on(t.userId,t.query),index("saved_searches_user_idx").on(t.userId)]);
export const discoveryPreferences = sqliteTable("discovery_preferences",{userId:text("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),priceSeenAt:text("price_seen_at").notNull(),priceEnabled:integer("price_enabled").notNull().default(1)});
export const priceHistory = sqliteTable("price_history",{id:text("id").primaryKey(),listingId:text("listing_id").notNull().references(()=>listings.id,{onDelete:"cascade"}),oldPrice:integer("old_price").notNull(),newPrice:integer("new_price").notNull(),currency:text("currency").notNull(),purpose:text("purpose").notNull(),changedAt:text("changed_at").notNull()},t=>[index("price_history_listing_idx").on(t.listingId,t.changedAt)]);

export const sellerProfiles=sqliteTable('seller_profiles',{userId:text('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),bio:text('bio').notNull().default(''),updatedAt:text('updated_at').notNull()});

export const listingDrafts = sqliteTable("listing_drafts", {userId:text("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),payload:text("payload").notNull(),version:integer("version").notNull().default(1),updatedAt:text("updated_at").notNull()});

export const adminAudit = sqliteTable("admin_audit", {id:text("id").primaryKey(),actorId:text("actor_id").notNull(),actorName:text("actor_name").notNull(),action:text("action").notNull(),targetId:text("target_id").notNull(),summary:text("summary").notNull(),createdAt:text("created_at").notNull()},t=>[index("admin_audit_time_idx").on(t.createdAt)]);

export const appointments = sqliteTable("appointments", {
 id:text("id").primaryKey(),listingId:text("listing_id").notNull().references(()=>listings.id,{onDelete:"cascade"}),buyerId:text("buyer_id").notNull().references(()=>users.id,{onDelete:"cascade"}),sellerId:text("seller_id").notNull().references(()=>users.id,{onDelete:"cascade"}),slotAt:text("slot_at").notNull(),message:text("message").notNull(),status:text("status").notNull().default("requested"),stage:text("stage").notNull().default("new"),privateNote:text("private_note").notNull().default(""),version:integer("version").notNull().default(1),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull()
},t=>[uniqueIndex("appointments_active_unique").on(t.buyerId,t.listingId).where(sql`${t.status} IN ('requested','confirmed')`),index("appointments_buyer_idx").on(t.buyerId,t.createdAt),index("appointments_seller_idx").on(t.sellerId,t.createdAt)]);

// Daily deduplication stores no IP address, contact detail or message content.
export const listingViewDaily=sqliteTable('listing_view_daily',{listingId:text('listing_id').notNull(),day:text('day').notNull(),visitorHash:text('visitor_hash').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.listingId,t.day,t.visitorHash]})]);

export const individualListingQuota=sqliteTable("individual_listing_quota",{userId:text("user_id").primaryKey().references(()=>users.id),lastSubmittedAt:text("last_submitted_at").notNull()});
export const listingSubmissions=sqliteTable("listing_submissions",{userId:text("user_id").notNull(),requestId:text("request_id").notNull(),payloadHash:text("payload_hash").notNull(),listingId:text("listing_id").notNull(),createdAt:text("created_at").notNull()},t=>[primaryKey({columns:[t.userId,t.requestId]})]);
