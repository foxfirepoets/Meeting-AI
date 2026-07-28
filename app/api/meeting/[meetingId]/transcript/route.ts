import { isValidSession } from "@/lib/auth";
import { getTranscript } from "@/lib/vexa";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  if (!isValidSession(request)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  const { meetingId } = await params;
  try {
    return Response.json({ meetingId, ...(await getTranscript(meetingId)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load transcript.";
    return Response.json({ error: message }, { status: 502 });
  }
}
