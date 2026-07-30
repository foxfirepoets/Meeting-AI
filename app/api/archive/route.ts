import { isValidSession } from "@/lib/auth";
import { getClientKey, allowRequest } from "@/lib/rate-limit";
import { listTranscripts, readTranscript, shareTranscript, storageEnabled } from "@/lib/store";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Any valid session may read the archive; it is not bound to one meeting.
  if (!isValidSession(request)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  if (!allowRequest(`archive:${getClientKey(request)}`, 60, 60_000)) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  if (!storageEnabled()) return Response.json({ error: "Transcript storage is not configured. Add BLOB_READ_WRITE_TOKEN." }, { status: 503 });

  const pathname = request.nextUrl.searchParams.get("path");
  try {
    if (!pathname) return Response.json({ transcripts: await listTranscripts() });
    const saved = await readTranscript(pathname);
    if (!saved) return Response.json({ error: "That transcript is not available." }, { status: 404 });
    return Response.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read stored transcripts.";
    return Response.json({ error: message }, { status: 502 });
  }
}

/** Publishes a read-only copy at /t/{token} that needs no access code. */
export async function POST(request: NextRequest) {
  if (!isValidSession(request)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  if (!allowRequest(`share:${getClientKey(request)}`, 20, 60_000)) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  if (!storageEnabled()) return Response.json({ error: "Transcript storage is not configured." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { path?: string };
  const pathname = body.path?.trim() || "";
  if (!pathname) return Response.json({ error: "A transcript path is required." }, { status: 400 });
  try {
    const token = await shareTranscript(pathname);
    if (!token) return Response.json({ error: "That transcript is not available." }, { status: 404 });
    return Response.json({ token, url: `${request.nextUrl.origin}/t/${token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create a share link.";
    return Response.json({ error: message }, { status: 502 });
  }
}
