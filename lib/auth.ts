import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "meeting_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  return process.env.SESSION_SECRET || process.env.ACCESS_CODE || "prototype-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken() {
  const payload = `${Date.now()}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  if (Date.now() - Number(parts[0]) > MAX_AGE_SECONDS * 1000) return false;
  const expected = sign(`${parts[0]}.${parts[1]}`);
  try {
    return timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE_SECONDS,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function expectedAccessCode() {
  return process.env.ACCESS_CODE || "demo-access";
}
