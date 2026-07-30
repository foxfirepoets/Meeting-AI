import { isValidSession, sessionCookie } from "@/lib/auth";
import { archiveTranscript } from "@/lib/store";
import { getTranscript, stopMeeting } from "@/lib/vexa";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  if (!isValidSession(request, meetingId)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  try {
    // Archive before stopping so the permanent copy is written while the
    // session is still valid; neither step may block the other.
    const archived = await getTranscript(meetingId)
      .then((result) => archiveTranscript(meetingId, result.entries).then(() => result.entries.length))
      .catch(() => 0);
    await stopMeeting(meetingId);
    const response = Response.json({ ok: true, archivedEntries: archived });
    response.headers.append(
      "Set-Cookie",
      `${sessionCookie.name}=; Max-Age=0; Path=${sessionCookie.path}; HttpOnly; SameSite=${sessionCookie.sameSite}${sessionCookie.secure ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not stop the meeting assistant.";
    return Response.json({ error: message }, { status: 502 });
  }
}
