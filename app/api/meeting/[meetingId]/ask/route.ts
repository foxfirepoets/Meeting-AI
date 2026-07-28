import { isValidSession } from "@/lib/auth";
import { answerQuestion } from "@/lib/llm";
import { getClientKey, allowRequest } from "@/lib/rate-limit";
import { getTranscript } from "@/lib/vexa";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  if (!isValidSession(request, meetingId)) return Response.json({ error: "Meeting session is required." }, { status: 401 });
  if (!allowRequest(`ask:${getClientKey(request)}:${meetingId}`, 30, 60_000)) return Response.json({ error: "Too many questions. Try again shortly." }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > 5_000) return Response.json({ error: "Question is too large." }, { status: 413 });
  const body = await request.json().catch(() => ({})) as { question?: string };
  const question = body.question?.trim() || "";
  if (!question) return Response.json({ error: "A question is required." }, { status: 400 });
  if (question.length > 1_200) return Response.json({ error: "Keep the question under 1,200 characters." }, { status: 400 });
  try {
    const { entries, mode } = await getTranscript(meetingId);
    if (!entries.length) return Response.json({ error: mode === "live" ? "The bot has not produced transcript text yet. Admit the bot and try again shortly." : "Transcript context is unavailable." }, { status: 409 });
    return Response.json(await answerQuestion(question, entries));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer question.";
    return Response.json({ error: message }, { status: 502 });
  }
}
