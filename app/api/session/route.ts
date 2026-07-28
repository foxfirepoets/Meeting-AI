import { createSessionToken, expectedAccessCode, sessionCookie } from "../../../lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { accessCode?: string; meetingId?: string };
  if (!body.meetingId?.trim()) return Response.json({ error: "Meeting ID is required." }, { status: 400 });
  if (!body.accessCode || body.accessCode !== expectedAccessCode()) {
    return Response.json({ error: "Invalid meeting access code." }, { status: 401 });
  }

  const response = Response.json({ ok: true, mode: process.env.VEXA_MODE?.toLowerCase() === "live" ? "live" : "demo" });
  response.headers.append("Set-Cookie", `${sessionCookie.name}=${createSessionToken()}; Max-Age=${sessionCookie.maxAge}; Path=${sessionCookie.path}; HttpOnly; SameSite=${sessionCookie.sameSite}${sessionCookie.secure ? "; Secure" : ""}`);
  return response;
}
