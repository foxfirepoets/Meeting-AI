import type { AnswerResult, Source, TranscriptEntry } from "./types";

function findSources(question: string, transcript: TranscriptEntry[]): Source[] {
  const terms = question.toLowerCase().split(/\s+/).filter((term) => term.length > 3);
  const matching = transcript.filter((entry) => terms.some((term) => entry.text.toLowerCase().includes(term)));
  return (matching.length ? matching : transcript.slice(0, 2)).slice(0, 3).map(({ id, speaker, timeLabel, text }) => ({ id, speaker, timeLabel, text }));
}

function demoAnswer(question: string, transcript: TranscriptEntry[]): AnswerResult {
  const lower = question.toLowerCase();
  const sources = findSources(question, transcript);
  let answer = "The meeting focused on a small beta launch for the weekly planning workflow.";
  if (lower.includes("who") || lower.includes("owner") || lower.includes("assign")) {
    answer = "Priya owns the dashboard QA checklist. Jon owns the partner invite email and is sending the final onboarding copy today.";
  } else if (lower.includes("when") || lower.includes("date") || lower.includes("launch")) {
    answer = "The team plans to invite five design partners on Thursday, after the dashboard QA pass.";
  } else if (lower.includes("risk")) {
    answer = "The main risk is delayed feedback from the first partners, so the team wants to keep the feedback form short.";
  }
  return {
    answer,
    sources,
    actions: ["Priya: finish the dashboard QA checklist before Thursday.", "Jon: send the final onboarding copy and partner invite email today."],
    mode: "demo",
  };
}

export async function answerQuestion(question: string, transcript: TranscriptEntry[]): Promise<AnswerResult> {
  const mode = process.env.LLM_MODE?.toLowerCase() || "demo";
  if (mode !== "live") return demoAnswer(question, transcript);

  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !apiKey || !model) throw new Error("LLM live mode requires LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL.");

  const context = transcript.map((entry) => `[${entry.timeLabel}] ${entry.speaker}: ${entry.text}`).join("\n");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Answer only from the transcript. Be concise and do not invent facts." },
        { role: "user", content: `Transcript:\n${context}\n\nQuestion: ${question}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`LLM provider returned HTTP ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("LLM provider returned an empty answer.");
  return { answer, sources: findSources(question, transcript), actions: [], mode: "live" };
}
