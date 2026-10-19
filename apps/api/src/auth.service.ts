import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "./prisma.service";
import { adminUser, AuthRequest, now, str } from "./common";
import { createHash, randomBytes, randomUUID, timingSafeEqual, pbkdf2 as pbkdf2Callback } from "node:crypto";
import { promisify } from "node:util";
import type { Response } from "express";
import type { users } from "@prisma/client";
import {validProfileImage} from './shared/seller-profiles';
import { normalizeContactPhone } from "./shared/phone";

const pbkdf2 = promisify(pbkdf2Callback);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const thirtyDays = 30 * 24 * 60 * 60 * 1000;
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: thirtyDays });

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async hashPassword(password: string) {
    const salt = randomBytes(32).toString("hex");
    const iterations = 210_000;
    const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
    return `pbkdf2$${iterations}$${salt}$${hash.toString("hex")}`;
  }
  async verifyPassword(password: string, stored: string) {
    const [method, rounds, salt, expected] = stored.split("$");
    const iterations = Number(rounds);
    if (method !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !/^[a-f0-9]{64}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
    const candidate = await pbkdf2(password, salt, iterations, 32, "sha256");
    return timingSafeEqual(candidate, Buffer.from(expected, "hex"));
  }
  publicUser(user: users) {
    const configured = process.env.EXXEL_ADMIN_EMAIL?.toLowerCase();
    return { id: user.id, email: user.email, email_verified: user.email_verified, name: user.name, phone: user.phone, whatsapp_enabled:user.whatsapp_enabled, role: user.role, agent_status: user.agent_status, company: user.company, avatar_url: user.avatar_url, isAdmin: adminUser(user) || Boolean(configured && user.email_verified && user.email.toLowerCase() === configured) };
  }
  isAdmin(user: users | null) { return Boolean(user && this.publicUser(user).isAdmin); }
  async accountProfile(user:users){const profile=await this.prisma.seller_profiles.findUnique({where:{user_id:user.id}});return {...this.publicUser(user),bio:profile?.bio||''};}
  async updateProfile(user:users,data:Record<string,unknown>){
    const name=Object.hasOwn(data,"name")?str(data.name,100):user.name;
    const phoneInput=Object.hasOwn(data,"phone")?str(data.phone,32):user.phone||"";
    const phone=phoneInput?normalizeContactPhone(phoneInput):null;
    const whatsappEnabled=Object.hasOwn(data,"whatsappEnabled")?data.whatsappEnabled===true:Boolean(user.whatsapp_enabled);
    if(name.length<2||phoneInput&&!phone||whatsappEnabled&&!phone)throw new BadRequestException("Adınızı ve ülke koduyla telefon numaranızı kontrol edin.");
    const previous=await this.prisma.seller_profiles.findUnique({where:{user_id:user.id}});
    const bio=Object.hasOwn(data,'bio')?str(data.bio,2001):previous?.bio||'';if(bio.length>2000)throw new BadRequestException('Tanıtım yazısı en fazla 2000 karakter olabilir.');
    const avatarUrl=Object.hasOwn(data,'avatarUrl')?str(data.avatarUrl,500):user.avatar_url||null;
    if(avatarUrl&&avatarUrl!==user.avatar_url){if(!validProfileImage(avatarUrl,user.id))throw new ForbiddenException('Kendi yüklediğiniz fotoğrafı kullanın.');}
    const [updated]=await this.prisma.$transaction([this.prisma.users.update({where:{id:user.id},data:{name,phone,whatsapp_enabled:whatsappEnabled?1:0,avatar_url:avatarUrl||null}}),this.prisma.seller_profiles.upsert({where:{user_id:user.id},create:{user_id:user.id,bio,updated_at:now()},update:{bio,updated_at:now()}})]);
    return {success:true,user:{...this.publicUser(updated),bio}};
  }
  async currentSessionKey(request:AuthRequest,userId:string){
    const access=request.cookies?.exxel_access;
    if(access){try{const payload=await this.jwt.verifyAsync<{sid:string}>(access,{issuer:'exxel-estate',audience:'exxel-estate-web'});const session=await this.prisma.sessions.findUnique({where:{token_hash:payload.sid}});if(session?.user_id===userId&&session.expires_at>now())return payload.sid;}catch{}}
    const token=request.cookies?.excell_session;return token&&/^[a-f0-9]{64}$/.test(token)?sha256(token):null;
  }
  async current(request: AuthRequest): Promise<users | null> {
    const access = request.cookies?.exxel_access;
    if (access) {
      try {
        const payload = await this.jwt.verifyAsync<{sub: string; sid: string}>(access, { issuer: "exxel-estate", audience: "exxel-estate-web" });
        const session = await this.prisma.sessions.findUnique({ where: { token_hash: payload.sid } });
        if (session && session.user_id === payload.sub && session.expires_at > now()) return this.prisma.users.findUnique({ where: { id: payload.sub } });
      } catch { /* The legacy session cookie can keep existing accounts signed in. */ }
    }
    const legacy = request.cookies?.excell_session;
    if (!legacy || !/^[a-f0-9]{64}$/.test(legacy)) return null;
    const session = await this.prisma.sessions.findUnique({ where: { token_hash: sha256(legacy) } });
    if (!session || session.expires_at <= now()) return null;
    return this.prisma.users.findUnique({ where: { id: session.user_id } });
  }
  async session(user: users, response: Response) {
    const token = randomBytes(32).toString("hex");
    const sid = sha256(token);
    await this.prisma.sessions.create({ data: { token_hash: sid, user_id: user.id, expires_at: new Date(Date.now() + thirtyDays).toISOString() } });
    const access = await this.jwt.signAsync({ sub: user.id, sid }, { expiresIn: "15m" });
    response.cookie("exxel_access", access, { ...cookieOptions(), maxAge: 15 * 60 * 1000 });
    response.cookie("excell_session", token, cookieOptions());
    return this.publicUser(user);
  }
  async logout(request: AuthRequest, response: Response) {
    const token = request.cookies?.excell_session;
    if (token) await this.prisma.sessions.deleteMany({ where: { token_hash: sha256(token) } });
    response.clearCookie("exxel_access", cookieOptions());
    response.clearCookie("excell_session", cookieOptions());
  }
  async register(data: Record<string, unknown>, response: Response) {
    const email = str(data.email, 254).toLowerCase(), name = str(data.name, 100), role = str(data.role, 20);
    const password = typeof data.password === "string" ? data.password : "";
    const company = str(data.company, 120);
    const category = data.companyCategory === "developer" ? "developer" : "agency";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || password.length < 10 || password.length > 128 || !["buyer", "individual", "agent"].includes(role)) throw new BadRequestException("Kayıt bilgilerini kontrol edin.");
    if (role === "agent" && company.length < 2) throw new BadRequestException("Emlak ofisi adını girin.");
    if (await this.prisma.users.findUnique({ where: { email } })) throw new ConflictException("Bu e-posta ile kayıtlı bir hesap var.");
    const id = randomUUID(), createdAt = now();
    const user = await this.prisma.$transaction(async (db) => {
      const created = await db.users.create({ data: { id, email, password_hash: await this.hashPassword(password), name, role, email_verified: 0, agent_status: role === "agent" ? "pending" : "none", company: company || null, created_at: createdAt } });
      if (role === "agent") await db.agencies.create({ data: { id: randomUUID(), owner_id: id, name: company, category, status: "pending", created_at: createdAt } });
      return created;
    });
    return this.session(user, response);
  }
  async login(data: Record<string, unknown>, request: AuthRequest, response: Response) {
    const email = str(data.email, 254).toLowerCase();
    const password = typeof data.password === "string" ? data.password : "";
    if (!email || !password) throw new BadRequestException("E-posta ve şifre gerekli.");
    const ip = request.ip || "local";
    const key = sha256(`login:${email}:${ip}`);
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const limit = await this.prisma.auth_limits.findUnique({ where: { key } });
    if (limit && limit.window_started_at > cutoff && limit.failures >= 10) throw new HttpException("Çok fazla giriş denemesi.", 429);
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user || !(await this.verifyPassword(password, user.password_hash))) {
      await this.prisma.auth_limits.upsert({ where: { key }, create: { key, failures: 1, window_started_at: now() }, update: { failures: limit && limit.window_started_at > cutoff ? { increment: 1 } : 1, window_started_at: limit && limit.window_started_at > cutoff ? limit.window_started_at : now() } });
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    }
    await this.prisma.auth_limits.deleteMany({ where: { key } });
    return this.session(user, response);
  }
  async requestSellerRole(user: users, data: Record<string, unknown>) {
    if (this.isAdmin(user)) throw new ForbiddenException("Yönetici hesabı değiştirilemez.");
    const role = str(data.role, 20), company = str(data.company, 120), category = data.companyCategory === "developer" ? "developer" : "agency";
    if (!["individual", "agent"].includes(role) || role === "agent" && company.length < 2) throw new BadRequestException("İlan veren türünü ve ofis adını kontrol edin.");
    await this.prisma.$transaction(async (db) => {
      await db.users.update({ where: { id: user.id }, data: { role, company: role === "agent" ? company : null, agent_status: role === "agent" ? "pending" : "none" } });
      if (role === "agent") await db.agencies.upsert({ where: { owner_id: user.id }, create: { id: randomUUID(), owner_id: user.id, name: company, category, status: "pending", created_at: now() }, update: { name: company, category, status: "pending" } });
      else await db.agencies.updateMany({ where: { owner_id: user.id }, data: { status: "inactive" } });
    });
    return { success: true, role, agent_status: role === "agent" ? "pending" : "none" };
  }
}
