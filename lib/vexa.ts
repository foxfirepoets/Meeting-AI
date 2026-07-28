import { demoTranscript } from "./demo-data";
import type { TranscriptEntry } from "./types";

type VexaRecord = Partial<TranscriptEntry> & {
  speaker?: string;
  text?: string;
  timestamp?: number | string;
};

function normalizeRecords(value: unknown): TranscriptEntry[] {
  const records = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && "transcript" in value
      ? (value as { transcript?: unknown }).transcript
      : typeof value === "object" && value !== null && "items" in value
        ? (value as { items?: unknown }).items
        : [];

  if (!Array.isArray(records)) return [];

  return records.flatMap((record, index) => {
    if (typeof record !== "object" || record === null) return [];
    const item = record as VexaRecord;
    const seconds = typeof item.timestamp === "number" ? item.timestamp : index;
    const text = typeof item.text === "string" ? item.text : "";
    if (!text) return [];
    return [{
      id: item.id ?? `vexa-${index + 1}`,
      speaker: item.speaker ?? "Participant",
      text,
      timeSeconds: seconds,
      timeLabel: item.timeLabel ?? `00:${String(seconds).padStart(2, "0")}`,
      source: item.source ?? "vexa",
    }];
  });
}

export async function getTranscript(meetingId: string): Promise<{ entries: TranscriptEntry[]; mode: "demo" | "live" }> {
  const mode = process.env.VEXA_MODE?.toLowerCase() || "demo";
  if (mode !== "live") return { entries: demoTranscript, mode: "demo" };

  const baseUrl = process.env.VEXA_BASE_URL;
  const apiKey = process.env.VEXA_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Vexa live mode requires VEXA_BASE_URL and VEXA_API_KEY.");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/meetings/${encodeURIComponent(meetingId)}/transcript`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Vexa returned HTTP ${response.status}.`);
  const entries = normalizeRecords(await response.json());
  if (!entries.length) throw new Error("Vexa returned no transcript records.");
  return { entries, mode: "live" };
}
