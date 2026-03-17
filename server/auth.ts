/**
 * Standalone JWT auth helper — no Manus SDK dependency.
 * Used for Hostinger / self-hosted deployments.
 */
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getUserByOpenId } from "./db";
import type { User } from "../drizzle/schema";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env variable is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  userId: string,
  options: { expiresInMs?: number; name?: string } = {}
): Promise<string> {
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    sub: userId,
    name: options.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ sub: string; name: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub as string | undefined;
    const name = (payload.name as string | undefined) ?? "";
    if (!sub) return null;
    return { sub, name };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[COOKIE_NAME];
  const session = await verifySessionToken(token);
  if (!session) return null;
  const user = await getUserByOpenId(session.sub);
  return user ?? null;
}
