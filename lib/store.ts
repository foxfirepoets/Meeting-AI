import { head, list, put } from "@vercel/blob";
import { sign } from "./auth";
import type { SavedTranscript, TranscriptEntry, TranscriptSummary } from "./types";

// Rolling copy is overwritten as the meeting runs; the archive copy is written
// once when the assistant stops so a reused Meet code cannot clobber history.
const LIVE_PREFIX = "transcripts/live/";
const ARCHIVE_PREFIX = "transcripts/archive/";
const SHARED_PREFIX = "transcripts/shared/";
const SAVE_INTERVAL_MS = 60_000;

const lastSaved = new Map<string, { at: number; count: number }>();

export function storageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function payload(meetingId: string, entries: TranscriptEntry[]): SavedTranscript {
  return { meetingId, savedAt: new Date().toISOString(), entryCount: entries.length, entries };
}

async function write(pathname: string, body: SavedTranscript) {
  await put(pathname, JSON.stringify(body), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

/** Rolling save during a meeting. Throttled so polling does not write every 5s. */
export async function saveTranscript(meetingId: string, entries: TranscriptEntry[]) {
  if (!storageEnabled() || !entries.length) return;
  const previous = lastSaved.get(meetingId);
  const now = Date.now();
  if (previous && previous.count === entries.length) return;
  if (previous && now - previous.at < SAVE_INTERVAL_MS) return;
  lastSaved.set(meetingId, { at: now, count: entries.length });
  await write(`${LIVE_PREFIX}${meetingId}.json`, payload(meetingId, entries));
}

/** Permanent copy, written when the assistant stops. Never overwritten. */
export async function archiveTranscript(meetingId: string, entries: TranscriptEntry[]) {
  if (!storageEnabled() || !entries.length) return;
  const record = payload(meetingId, entries);
  lastSaved.delete(meetingId);
  await write(`${ARCHIVE_PREFIX}${meetingId}--${record.savedAt.replace(/[:.]/g, "-")}.json`, record);
  await write(`${LIVE_PREFIX}${meetingId}.json`, record);
}

export async function listTranscripts(): Promise<TranscriptSummary[]> {
  if (!storageEnabled()) return [];
  const [archived, live] = await Promise.all([
    list({ prefix: ARCHIVE_PREFIX, limit: 200 }),
    list({ prefix: LIVE_PREFIX, limit: 200 }),
  ]);
  const seen = new Set<string>();
  return [...archived.blobs, ...live.blobs]
    .map((blob) => ({
      pathname: blob.pathname,
      meetingId: blob.pathname.replace(ARCHIVE_PREFIX, "").replace(LIVE_PREFIX, "").replace(/\.json$/, "").split("--")[0],
      savedAt: blob.uploadedAt instanceof Date ? blob.uploadedAt.toISOString() : String(blob.uploadedAt),
      archived: blob.pathname.startsWith(ARCHIVE_PREFIX),
    }))
    .filter((item) => (seen.has(item.pathname) ? false : seen.add(item.pathname)))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Share tokens are an HMAC of the stored path, so sharing the same transcript
 * twice yields the same link and the token cannot be guessed from the meeting
 * code. Anyone holding the link can read that transcript without signing in.
 */
export function shareToken(pathname: string) {
  return sign(`share:${pathname}`).slice(0, 32);
}

export async function shareTranscript(pathname: string): Promise<string | null> {
  const saved = await readTranscript(pathname);
  if (!saved) return null;
  const token = shareToken(pathname);
  await write(`${SHARED_PREFIX}${token}.json`, saved);
  return token;
}

export async function readShared(token: string): Promise<SavedTranscript | null> {
  if (!storageEnabled() || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return await readTranscript(`${SHARED_PREFIX}${token}.json`);
}

export async function readTranscript(pathname: string): Promise<SavedTranscript | null> {
  if (!storageEnabled()) return null;
  if (![ARCHIVE_PREFIX, LIVE_PREFIX, SHARED_PREFIX].some((prefix) => pathname.startsWith(prefix))) return null;
  const meta = await head(pathname).catch(() => null);
  if (!meta) return null;
  const response = await fetch(meta.url, { cache: "no-store" });
  if (!response.ok) return null;
  return await response.json() as SavedTranscript;
}
