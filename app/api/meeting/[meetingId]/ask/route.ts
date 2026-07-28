import { isValidSession } from "@/lib/auth";
import { answerQuestion } from "@/lib/llm";
import type { TranscriptEntry } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  if (!isValidSession(request)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  await params;
  const body = await request.json().catch(() => ({})) as { question?: string; transcript?: TranscriptEntry[] };
  if (!body.question?.trim()) return Response.json({ error: "A question is required." }, { status: 400 });
  if (!Array.isArray(body.transcript) || body.transcript.length === 0) return Response.json({ error: "Transcript context is required." }, { status: 400 });
  try {
    return Response.json(await answerQuestion(body.question.trim(), body.transcript));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer question.";
    return Response.json({ error: message }, { status: 502 });
  }
}
