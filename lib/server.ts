import {listingExpired} from './listing-policy';
import { env } from "cloudflare:workers";
import { PUBLIC_DEMO_LISTINGS, type Listing } from "./listings";
import { neonD1 } from "./neon-d1";

type SiteEnv = Cloudflare.Env & { EXXEL_ADMIN_EMAIL?: string; DATABASE_URL?: string };
export const db = () => {
  const settings = env as SiteEnv;
  if (settings.DATABASE_URL) return neonD1(settings.DATABASE_URL) as unknown as D1Database;
  const database = settings.DB;
  if (!database) throw new Error("Database binding unavailable");
  return database;
};
export const bucket = () => (env as SiteEnv).BUCKET;
export async function publishedListingEntries(){const rows=await db().prepare("SELECT id,updated_at FROM listings WHERE status='published' ORDER BY updated_at DESC,id DESC LIMIT 10000").all<{id:string;updated_at:string}>();return rows.results.map(row=>({id:String(row.id),updatedAt:String(row.updated_at)}));}
export const now = () => new Date().toISOString();
export const error = (message:string, status=400) => Response.json({error:message},{status});
export const ok = (data:unknown, init?:ResponseInit) => Response.json(data, init);
export function sameOrigin(request:Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export class RequestInputError extends Error {}
export async function body(request:Request):Promise<Record<string,unknown>> {
  if (Number(request.headers.get("content-length") || 0) > 100_000) throw new RequestInputError("İstek çok büyük.");
  const reader=request.body?.getReader();if(!reader)throw new RequestInputError('İstek içeriği gerekli.');
  let size=0;const parts:Uint8Array[]=[];
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>100_000){await reader.cancel();throw new RequestInputError('İstek çok büyük.');}parts.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RequestInputError('Geçerli JSON içeriği gerekli.');}
  if (!input || Array.isArray(input) || typeof input !== "object") throw new RequestInputError("Geçersiz istek.");
  return input as Record<string,unknown>;
}
export const str = (value:unknown, max=500) => typeof value === "string" ? value.trim().slice(0,max) : "";
export const num = (value:unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};
const hex = (buffer:ArrayBuffer) => Array.from(new Uint8Array(buffer)).map((b)=>b.toString(16).padStart(2,"0")).join("");
export async function sha256(value:string) { return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))); }
const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers WebCrypto rejects higher iteration counts.
export async function passwordHash(password:string, salt?:string, iterations=PBKDF2_ITERATIONS) {
  const actualSalt = salt || hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(actualSalt),iterations},key,256);
  return `pbkdf2$${iterations}$${actualSalt}$${hex(derived)}`;
}
export async function verifyPassword(password:string, stored:string) {
  const segments = stored.split("$");
  if (segments.length !== 4 || segments[0] !== "pbkdf2") return false;
  const iterations = Number(segments[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > PBKDF2_ITERATIONS || !/^[0-9a-f]{32,64}$/.test(segments[2])) return false;
  const candidate = await passwordHash(password,segments[2],iterations);
  const a = new TextEncoder().encode(candidate), b = new TextEncoder().encode(stored);
  if (a.length !== b.length) return false;
  let diff=0; for (let i=0;i<a.length;i++) diff |= a[i]^b[i];
  return diff===0;
}
export type User = {id:string; email:string; email_verified:number; name:string; role:string; agent_status:string; phone?:string|null; whatsapp_enabled?:number; company?:string|null; avatar_url?:string|null};
export async function currentUser(request:Request):Promise<User|null> {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db().prepare("SELECT u.id,u.email,u.email_verified,u.name,u.role,u.agent_status,u.phone,u.whatsapp_enabled,u.company,u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash,now()).first<User>();
  return row || null;
}
export function sessionCookie(token:string, clear=false) {
  return `excell_session=${clear?"":token}; HttpOnly; Secure; SameSite=Lax; Path=/; ${clear?"Max-Age=0":"Max-Age=2592000"}`;
}
export async function createSession(userId:string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await db().prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await sha256(token),userId,new Date(Date.now()+30*864e5).toISOString()).run();
  return token;
}
export function isAdmin(user:User|null) {
  const configured = (env as SiteEnv).EXXEL_ADMIN_EMAIL?.toLowerCase();
  return Boolean(user && (user.role==="admin" || (configured && user.email_verified && user.email.toLowerCase()===configured)));
}
export function parseListing(row:Record<string,unknown>):Listing {
  return {
    presentation:JSON.parse(String(row.presentation||"{}")),id:String(row.id), title:String(row.title),description:String(row.description), purpose:row.purpose as Listing["purpose"],propertyType:row.property_type as Listing["propertyType"],
    price:Number(row.price),currency:String(row.currency),city:String(row.city),district:String(row.district),neighborhood:row.neighborhood?String(row.neighborhood):undefined,neighborhoodId:row.neighborhood_id==null?undefined:Number(row.neighborhood_id),postalCode:row.postal_code?String(row.postal_code):undefined,
    latitude:row.latitude==null?undefined:Number(row.latitude),longitude:row.longitude==null?undefined:Number(row.longitude),grossArea:Number(row.gross_area),netArea:row.net_area==null?undefined:Number(row.net_area),
    rooms:row.rooms?String(row.rooms):undefined,bedrooms:row.bedrooms==null?undefined:Number(row.bedrooms),bathrooms:row.bathrooms==null?undefined:Number(row.bathrooms),
    buildingAge:row.building_age==null?undefined:Number(row.building_age),floor:row.floor==null?undefined:Number(row.floor),totalFloors:row.total_floors==null?undefined:Number(row.total_floors),
    heating:row.heating?String(row.heating):undefined,furnished:row.furnished==null?undefined:Boolean(row.furnished),amenities:JSON.parse(String(row.amenities||"[]")),images:JSON.parse(String(row.images||"[]")),
    translations:JSON.parse(String(row.translations||"{}")),featured:Boolean(row.featured),status:listingExpired(row.expires_at)?"expired":String(row.status),expiresAt:row.expires_at?String(row.expires_at):undefined,reviewNote:row.review_note?String(row.review_note):undefined,reviewedAt:row.reviewed_at?String(row.reviewed_at):undefined,ownerName:row.owner_name?String(row.owner_name):"Exxel Estate",ownerId:String(row.owner_id),createdAt:String(row.created_at),publishedAt:row.published_at?String(row.published_at):undefined,updatedAt:String(row.updated_at),source:"user"
  };
}
export async function listingById(id:string):Promise<Listing|null> {
  const demo = PUBLIC_DEMO_LISTINGS.find((item)=>item.id===id);
  if (demo) return demo;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  const row = await db().prepare("SELECT l.*,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?").bind(id).first<Record<string,unknown>>();
  return row?parseListing(row):null;
}
