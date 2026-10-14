import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { AuthRequest, now } from "./common";
import { PrismaService } from "./prisma.service";

const sha256 = (value:string) => createHash("sha256").update(value).digest("hex");
const safePath = (value: unknown, fallback = "/hesabim") => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try { const url = new URL(value, "https://exxel.invalid"); return url.origin === "https://exxel.invalid" && !url.pathname.startsWith("/api/auth/") ? `${url.pathname}${url.search}${url.hash}` : fallback; } catch { return fallback; }
};
const config = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET, redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  try { const url = new URL(redirectUri); if (url.protocol !== "https:" || url.pathname !== "/api/auth/callback/google" || url.origin !== process.env.FRONTEND_ORIGIN) return null; return {clientId,clientSecret,redirectUri,origin:url.origin}; } catch { return null; }
};

@Controller("auth")
export class GoogleController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  private fail(response:Response, origin:string, reason:string) { response.clearCookie("exxel_google_flow", {path:"/api/auth"}); return response.redirect(302, `${origin}/giris?google=${reason}`); }
  @Get("google") async start(@Query() query:Record<string,string>, @Req() request:AuthRequest, @Res() response:Response) {
    const settings = config();
    if (query.status === "1") return response.json({enabled:Boolean(settings)});
    if (!settings) return response.redirect(302, `${process.env.FRONTEND_ORIGIN || ""}/giris?google=unavailable`);
    const link = query.link === "1", user = link ? await this.auth.current(request) : null;
    if (link && !user) return response.redirect(302, `${settings.origin}/giris?next=%2Fhesabim%3Ftab%3Dprofil`);
    const role = ["individual","agent"].includes(query.role) ? query.role : "buyer";
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(32).toString("base64url");
    await this.prisma.oauth_flows.deleteMany({where:{expires_at:{lt:now()}}});
    await this.prisma.oauth_flows.create({data:{state_hash:sha256(state),code_verifier:verifier,role,next_path:safePath(query.next,link?"/hesabim?tab=profil":"/hesabim"),link_user_id:user?.id||null,expires_at:new Date(Date.now()+600_000).toISOString()}});
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key,value] of Object.entries({client_id:settings.clientId,redirect_uri:settings.redirectUri,response_type:"code",scope:"openid email profile",state,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",prompt:"select_account"})) url.searchParams.set(key,value);
    response.cookie("exxel_google_flow",state,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/auth",maxAge:600_000});
    response.setHeader("Cache-Control","no-store");
    return response.redirect(302,url.toString());
  }
  @Get("callback/google") async callback(@Query() query:Record<string,string>, @Req() request:AuthRequest, @Res() response:Response) {
    const settings = config(); const origin = settings?.origin || process.env.FRONTEND_ORIGIN || "";
    if (!settings) return this.fail(response,origin,"unavailable");
    if (query.error) return this.fail(response,origin,"cancelled");
    const state = query.state, code = query.code;
    if (!state || !code || state !== request.cookies?.exxel_google_flow || state.length > 100 || code.length > 4096) return this.fail(response,origin,"invalid");
    const flow = await this.prisma.oauth_flows.findUnique({where:{state_hash:sha256(state)}});
    if (!flow || flow.expires_at <= now()) return this.fail(response,origin,"expired");
    await this.prisma.oauth_flows.delete({where:{state_hash:sha256(state)}});
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:settings.clientId,client_secret:settings.clientSecret,redirect_uri:settings.redirectUri,grant_type:"authorization_code",code_verifier:flow.code_verifier})});
      if (!tokenResponse.ok) return this.fail(response,origin,"exchange");
      const token = await tokenResponse.json() as {access_token?:string};
      if (!token.access_token) return this.fail(response,origin,"exchange");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${token.access_token}`}});
      if (!profileResponse.ok) return this.fail(response,origin,"identity");
      const profile = await profileResponse.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string;picture?:string};
      const email = profile.email?.trim().toLowerCase();
      if (!profile.sub || !email || profile.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.fail(response,origin,"identity");
      const avatar = profile.picture?.startsWith("https://") ? profile.picture.slice(0,500) : null;
      const mapped = await this.prisma.oauth_accounts.findUnique({where:{provider_provider_user_id:{provider:"google",provider_user_id:profile.sub}}});
      let userId = mapped?.user_id;
      if (flow.link_user_id) {
        const signedIn = await this.auth.current(request);
        if (!signedIn || signedIn.id !== flow.link_user_id || signedIn.email.toLowerCase() !== email || userId && userId !== signedIn.id) return this.fail(response,origin,"link");
        if (!userId) await this.prisma.oauth_accounts.create({data:{provider:"google",provider_user_id:profile.sub,user_id:signedIn.id,created_at:now()}});
        userId = signedIn.id;
        await this.prisma.users.update({where:{id:userId},data:{email_verified:1,avatar_url:avatar||signedIn.avatar_url}});
      } else if (!userId) {
        if (await this.prisma.users.findUnique({where:{email}})) return this.fail(response,origin,"existing");
        userId = randomUUID(); const createdAt = now();
        await this.prisma.$transaction([this.prisma.users.create({data:{id:userId,email,password_hash:"google-only",email_verified:1,name:profile.name?.trim().slice(0,100)||email.split("@")[0],role:flow.role,agent_status:flow.role==="agent"?"pending":"none",avatar_url:avatar,created_at:createdAt}}),this.prisma.oauth_accounts.create({data:{provider:"google",provider_user_id:profile.sub,user_id:userId,created_at:createdAt}})]);
      } else if (avatar) await this.prisma.users.update({where:{id:userId},data:{avatar_url:avatar}});
      const user = await this.prisma.users.findUniqueOrThrow({where:{id:userId}});
      await this.auth.session(user,response);
      response.clearCookie("exxel_google_flow",{path:"/api/auth"});
      response.setHeader("Cache-Control","no-store");
      return response.redirect(302,`${settings.origin}${safePath(flow.next_path)}`);
    } catch { return this.fail(response,origin,"failed"); }
  }
}
