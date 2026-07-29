import { demoTranscript } from "./demo-data";
import type { TranscriptEntry } from "./types";

const PLATFORM = "google_meet";
const REQUEST_TIMEOUT_MS = 15_000;

type VexaRecord = {
  id?: string | number;
  speaker?: string;
  text?: string;
  timestamp?: number | string;
  start_time?: number;
  timeLabel?: string;
  source?: string;
};

function vexaConfig() {
  const baseUrl = process.env.VEXA_BASE_URL?.replace(/\/$/, "");
  // Hosted Vexa issues separate keys for bot control and transcription.
  // Keep VEXA_API_KEY as a backwards-compatible fallback for older deployments.
  const botApiKey = process.env.VEXA_BOT_API_KEY || process.env.VEXA_API_KEY;
  const transcriptionApiKey = process.env.VEXA_TRANSCRIPTION_API_KEY || process.env.VEXA_API_KEY;
  if (!baseUrl || !botApiKey || !transcriptionApiKey) {
    throw new Error("Vexa live mode requires VEXA_BASE_URL, VEXA_BOT_API_KEY, and VEXA_TRANSCRIPTION_API_KEY.");
  }
  return { baseUrl, botApiKey, transcriptionApiKey };
}

function fetchWithTimeout(input: string, init: RequestInit = {}) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
}

function normalizeRecords(value: unknown): TranscriptEntry[] {
  const container = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const records = Array.isArray(value)
    ? value
    : Array.isArray(container.segments) ? container.segments
      : Array.isArray(container.transcript) ? container.transcript
        : Array.isArray(container.items) ? container.items : [];

  return records.flatMap((record, index) => {
    if (typeof record !== "object" || record === null) return [];
    const item = record as VexaRecord;
    const rawSeconds = item.start_time ?? item.timestamp ?? index;
    const seconds = Number.isFinite(Number(rawSeconds)) ? Number(rawSeconds) : index;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text || text.length > 20_000) return [];
    return [{
      id: String(item.id ?? `vexa-${index + 1}`),
      speaker: item.speaker?.trim() || "Participant",
      text,
      timeSeconds: seconds,
      timeLabel: item.timeLabel ?? formatTime(seconds),
      source: item.source ?? "vexa",
    }];
  });
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function parseGoogleMeetLink(value: string) {
  const input = value.trim();
  if (!input) throw new Error("Paste a Google Meet link.");
  if (process.env.VEXA_MODE?.toLowerCase() !== "live" && input === "demo") return "demo-meeting-001";

  let code = input;
  try {
    const url = new URL(input);
    if (url.hostname !== "meet.google.com") throw new Error("Use a Google Meet link from meet.google.com.");
    if (url.pathname.startsWith("/lookup/")) throw new Error("Open the calendar invite and copy the standard Google Meet link.");
    code = url.pathname.split("/").filter(Boolean)[0] || "";
  } catch (error) {
    if (error instanceof Error && error.message !== "Invalid URL") throw error;
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+){1,3}$/i.test(code) || code.length > 64) {
    throw new Error("Enter a full Google Meet link, such as https://meet.google.com/abc-defg-hij.");
  }
  return code;
}

export async function startMeeting(meetingId: string) {
  const mode = process.env.VEXA_MODE?.toLowerCase() || "demo";
  if (mode !== "live") return { mode: "demo" as const, status: "active" as const };
  const { baseUrl, botApiKey } = vexaConfig();
  const response = await fetchWithTimeout(`${baseUrl}/bots`, {
    method: "POST",
    headers: { "X-API-Key": botApiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      platform: PLATFORM,
      native_meeting_id: meetingId,
      bot_name: "Meeting-AI Notetaker",
      recording_enabled: true,
      transcribe_enabled: true,
      transcription_tier: "realtime",
      voice_agent_enabled: false,
    }),
  });
  if (!response.ok && response.status !== 409) throw new Error(`Vexa could not start the meeting bot (HTTP ${response.status}).`);
  return { mode: "live" as const, status: "requested" as const };
}

export async function stopMeeting(meetingId: string) {
  const mode = process.env.VEXA_MODE?.toLowerCase() || "demo";
  if (mode !== "live") return;
  const { baseUrl, botApiKey } = vexaConfig();
  const response = await fetchWithTimeout(`${baseUrl}/bots/${PLATFORM}/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
    headers: { "X-API-Key": botApiKey, Accept: "application/json" },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Vexa could not stop the meeting bot (HTTP ${response.status}).`);
}

export async function getTranscript(meetingId: string): Promise<{ entries: TranscriptEntry[]; mode: "demo" | "live" }> {
  const mode = process.env.VEXA_MODE?.toLowerCase() || "demo";
  if (mode !== "live") return { entries: demoTranscript, mode: "demo" };
  const { baseUrl, transcriptionApiKey } = vexaConfig();
  const response = await fetchWithTimeout(`${baseUrl}/transcripts/${PLATFORM}/${encodeURIComponent(meetingId)}`, {
    headers: { "X-API-Key": transcriptionApiKey, Accept: "application/json" },
  });
  if (response.status === 404) return { entries: [], mode: "live" };
  if (!response.ok) throw new Error(`Vexa transcript request failed (HTTP ${response.status}).`);
  return { entries: normalizeRecords(await response.json()), mode: "live" };
}
