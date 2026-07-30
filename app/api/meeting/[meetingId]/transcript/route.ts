import { isValidSession } from "@/lib/auth";
import { saveTranscript } from "@/lib/store";
import { getTranscript } from "@/lib/vexa";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  if (!isValidSession(request, meetingId)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  try {
    const result = await getTranscript(meetingId);
    // Storage failures must never break the live transcript view.
    await saveTranscript(meetingId, result.entries).catch(() => {});
    return Response.json({ meetingId, ...result, waitingForBot: result.mode === "live" && result.entries.length === 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load transcript.";
    return Response.json({ error: message }, { status: 502 });
  }
}
