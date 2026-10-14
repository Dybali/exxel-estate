import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("buyer"),
  agentStatus: text("agent_status").notNull().default("none"),
  company: text("company"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

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
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("listings_search_idx").on(t.status, t.purpose, t.propertyType, t.city, t.price),
  index("listings_location_idx").on(t.status, t.city, t.district),
  index("listings_price_idx").on(t.status, t.price),
  index("listings_recent_idx").on(t.status, t.createdAt),
  index("listings_area_idx").on(t.grossArea),
  index("listings_owner_idx").on(t.ownerId),
]);

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
