import { isValidSession } from "@/lib/auth";
import { stopMeeting } from "@/lib/vexa";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  if (!isValidSession(request, meetingId)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  try {
    await stopMeeting(meetingId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not stop the meeting assistant.";
    return Response.json({ error: message }, { status: 502 });
  }
}
