import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { users } from "@prisma/client";

export type AuthRequest = Request & { cookies?: Record<string, string> };
export const now = () => new Date().toISOString();
export const str = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
export const positive = (value: unknown, name: string) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new BadRequestException(`${name} geçersiz.`);
  return number;
};
export const assertOrigin = (request: AuthRequest) => {
  const origin = request.headers.origin;
  const allowed = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",").map((value) => value.trim());
  if (origin && !allowed.includes(origin)) throw new ForbiddenException("Geçersiz kaynak.");
};
export function requireUser(user: users | null): asserts user is users {
  if (!user) throw new UnauthorizedException("Giriş gerekli.");
}
export const adminUser = (user: users | null) => Boolean(user && user.role === "admin");
export const safeJson = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };
