import { createSessionToken, isValidAccessCode, sessionCookie } from "../../../lib/auth";
import { getClientKey, allowRequest } from "../../../lib/rate-limit";
import { parseGoogleMeetLink, startMeeting } from "../../../lib/vexa";

export async function POST(request: Request) {
  if (!allowRequest(`session:${getClientKey(request)}`, 10, 60_000)) return Response.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > 10_000) return Response.json({ error: "Request is too large." }, { status: 413 });
  const body = await request.json().catch(() => ({})) as { accessCode?: string; meetingUrl?: string; meetingId?: string; archiveOnly?: boolean };
  const meetingInput = body.meetingUrl?.trim() || body.meetingId?.trim() || "";
  if (!body.archiveOnly && !meetingInput) return Response.json({ error: "Paste a Google Meet link." }, { status: 400 });
  if (meetingInput.length > 500) return Response.json({ error: "Meeting link is too long." }, { status: 400 });
  try {
    if (!body.accessCode || body.accessCode.length > 200 || !isValidAccessCode(body.accessCode)) {
      return Response.json({ error: "Invalid meeting access code." }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "The app is not configured with an access code yet." }, { status: 503 });
  }
  // Reading saved transcripts needs the access code but must not send a bot.
  if (body.archiveOnly) {
    const response = Response.json({ ok: true, archiveOnly: true });
    response.headers.append("Set-Cookie", `${sessionCookie.name}=${createSessionToken("archive")}; Max-Age=${sessionCookie.maxAge}; Path=${sessionCookie.path}; HttpOnly; SameSite=${sessionCookie.sameSite}${sessionCookie.secure ? "; Secure" : ""}`);
    return response;
  }

  let meetingId: string;
  try {
    meetingId = parseGoogleMeetLink(meetingInput);
    const started = await startMeeting(meetingId);
    const response = Response.json({ ok: true, meetingId, ...started });
    response.headers.append("Set-Cookie", `${sessionCookie.name}=${createSessionToken(meetingId)}; Max-Age=${sessionCookie.maxAge}; Path=${sessionCookie.path}; HttpOnly; SameSite=${sessionCookie.sameSite}${sessionCookie.secure ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the meeting assistant.";
    const status =
      message.includes("required") || message.includes("Google Meet") || message.includes("Enter") || message.includes("Paste") || message.includes("lookup")
        ? 400
        : message.includes("not configured")
          ? 503
          : 502;
    return Response.json({ error: message }, { status });
  }
}
