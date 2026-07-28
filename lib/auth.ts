import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "meeting_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "prototype-session-secret";
  throw new Error("SESSION_SECRET must be configured in production.");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(meetingId: string) {
  const payload = `${Date.now()}.${randomUUID()}.${meetingId}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(request: NextRequest, meetingId?: string) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || !/^\d+$/.test(parts[0])) return false;
  if (Date.now() - Number(parts[0]) > MAX_AGE_SECONDS * 1000) return false;
  const expected = sign(parts.slice(0, 3).join("."));
  try {
    const validSignature = timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected));
    return validSignature && (!meetingId || parts[2] === meetingId);
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
  const value = process.env.ACCESS_CODE;
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "demo-access";
  throw new Error("ACCESS_CODE must be configured in production.");
}

export function isValidAccessCode(value: string) {
  const expected = Buffer.from(expectedAccessCode());
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
