"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import type { AnswerResult, SavedTranscript, TranscriptEntry, TranscriptSummary } from "@/lib/types";

export default function Home() {
  const [meetingLink, setMeetingLink] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  // Ask failures are tracked separately so the transcript poller cannot erase them.
  const [askError, setAskError] = useState("");
  const [status, setStatus] = useState("Paste a Google Meet link to start.");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [archive, setArchive] = useState<TranscriptSummary[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveEntry, setArchiveEntry] = useState<SavedTranscript | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [shareLink, setShareLink] = useState("");

  async function loadTranscript(id: string) {
    const response = await fetch(`/api/meeting/${encodeURIComponent(id)}/transcript`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not load transcript.");
    const entries = Array.isArray(body.entries) ? body.entries : [];
    setTranscript(entries);
    setStatus(
      body.waitingForBot
        ? "Bot requested. Admit Meeting-AI Notetaker in Google Meet; transcript will appear here."
        : `${body.mode === "demo" ? "Demo" : "Live"} transcript - ${entries.length} moments`,
    );
    return entries;
  }

  useEffect(() => {
    if (!meetingId) return;
    let active = true;
    const poll = async () => {
      try {
        const entries = await loadTranscript(meetingId);
        if (active && entries.length) setError("");
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not refresh transcript.");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [meetingId]);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (loading || stopping) return;
    setLoading(true);
    setError("");
    setAskError("");
    setAnswer(null);
    setTranscript([]);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: meetingLink, accessCode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not start meeting assistant.");
      setMeetingId(body.meetingId);
      setStatus(
        body.mode === "demo"
          ? "Demo transcript loading."
          : body.status === "already_running"
            ? "Assistant already connected for this Meet. Admit Meeting-AI Notetaker if it is still waiting."
            : "Bot requested. Admit Meeting-AI Notetaker in Google Meet, then keep this page open.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    if (!meetingId || stopping) return;
    setStopping(true);
    setError("");
    try {
      const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/stop`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not stop assistant.");
      setStatus("Assistant stopped.");
      setMeetingId("");
      setTranscript([]);
      setAnswer(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not stop assistant.");
    } finally {
      setStopping(false);
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !meetingId || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not answer question.");
      setAnswer(body);
    } catch (caught) {
      setAskError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }

  // The panel advertises Enter, but a textarea never submits its form on its own.
  function askOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void ask(event as unknown as FormEvent);
  }

  async function openArchive() {
    setArchiveOpen(true);
    setArchiveLoading(true);
    setArchiveError("");
    setArchiveEntry(null);
    try {
      let response = await fetch("/api/archive", { cache: "no-store" });
      if (response.status === 401) {
        const unlock = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessCode, archiveOnly: true }),
        });
        if (!unlock.ok) throw new Error("Enter the team access code above, then open saved transcripts again.");
        response = await fetch("/api/archive", { cache: "no-store" });
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load saved transcripts.");
      setArchive(Array.isArray(body.transcripts) ? body.transcripts : []);
    } catch (caught) {
      setArchiveError(caught instanceof Error ? caught.message : "Could not load saved transcripts.");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function shareSaved(pathname: string) {
    setArchiveError("");
    try {
      const response = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create a share link.");
      setShareLink(body.url);
      await navigator.clipboard.writeText(body.url).catch(() => {});
    } catch (caught) {
      setArchiveError(caught instanceof Error ? caught.message : "Could not create a share link.");
    }
  }

  async function openSaved(pathname: string) {
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const response = await fetch(`/api/archive?path=${encodeURIComponent(pathname)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not open that transcript.");
      setArchiveEntry(body);
    } catch (caught) {
      setArchiveError(caught instanceof Error ? caught.message : "Could not open that transcript.");
    } finally {
      setArchiveLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">AI</span><span>meeting-ai</span></div><div className="topbar-note"><span className="status-dot" /> silent by design</div></header>
      <section className="hero"><div><p className="eyebrow">Quiet meeting companion</p><h1>Stay in the room.<br /><em>Ask when you need to.</em></h1><p className="lede">Vexa transcribes the meeting quietly. Claude answers questions in this side panel.</p></div><div className="hero-badge"><span>OFF</span> No automatic speaking<br /><small>Human approval stays in control</small></div></section>

      <form className="access-card" onSubmit={start}>
        <div className="field-group"><label htmlFor="meeting-link">Google Meet link</label><input id="meeting-link" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/abc-defg-hij" /></div>
        <div className="field-group"><label htmlFor="access-code">Team access code</label><input id="access-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Your team code" /></div>
        <div className="access-actions"><button className="primary-button" type="submit" disabled={loading || stopping}>{loading ? "Starting..." : meetingId ? "Restart assistant" : "Start assistant"}<span>-&gt;</span></button>{meetingId && <button className="secondary-button" type="button" disabled={stopping || loading} onClick={() => void stop()}>{stopping ? "Stopping..." : "Stop"}</button>}</div>
      </form>

      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="workspace-grid">
        <section className="panel transcript-panel" aria-labelledby="transcript-heading"><div className="panel-heading"><div><p className="eyebrow">Live context</p><h2 id="transcript-heading">Transcript</h2></div><span className="mode-pill">{meetingId ? "connected" : "waiting"}</span></div><p className="panel-status">{status}</p><div className="transcript-feed">{transcript.length ? transcript.map((entry) => <article className="transcript-item" key={entry.id}><div className="transcript-meta"><strong>{entry.speaker}</strong><span>{entry.timeLabel}</span></div><p>{entry.text}</p></article>) : <div className="empty-state"><span className="empty-icon">*</span><strong>Your meeting transcript will appear here.</strong><p>Start the assistant and admit the Vexa notetaker when Google Meet asks.</p></div>}</div></section>
        <div className="right-column">
          <section className="panel ask-panel" aria-labelledby="ask-heading"><div className="panel-heading"><div><p className="eyebrow">Ask quietly</p><h2 id="ask-heading">What do you need?</h2></div><span className="keyboard-hint">Enter</span></div><form onSubmit={ask}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={askOnEnter} disabled={!meetingId || asking} placeholder={meetingId ? "Who owns the follow-up?" : "Start a meeting to ask questions..."} rows={3} />{askError && <p className="error-banner" role="alert">{askError}</p>}<div className="ask-footer"><span>Answers use the server-side transcript.</span><button className="ask-button" type="submit" disabled={!meetingId || !question.trim() || asking}>{asking ? "Thinking..." : "Ask"} <span>-&gt;</span></button></div></form></section>
          <section className="panel answer-panel" aria-labelledby="answer-heading"><div className="panel-heading"><div><p className="eyebrow">Assistant</p><h2 id="answer-heading">Answer</h2></div>{answer && <span className="mode-pill">{answer.mode}</span>}</div>{answer ? <><p className="answer-copy">{answer.answer}</p><div className="subsection"><h3>Sources</h3>{answer.sources.map((source) => <div className="source-row" key={source.id}><span className="source-time">{source.timeLabel}</span><span><strong>{source.speaker}</strong> - {source.text}</span></div>)}</div></> : <div className="answer-placeholder"><span>-&gt;</span><p>Your answer and the moments behind it will land here.</p></div>}</section>
          <section className="panel actions-panel" aria-labelledby="actions-heading"><div className="panel-heading"><div><p className="eyebrow">Proposed, not automatic</p><h2 id="actions-heading">Action items</h2></div><span className="count-pill">{answer?.actions.length ?? 0}</span></div>{answer?.actions.length ? <div className="action-list">{answer.actions.map((action) => <div className="action-row" key={action}><span className="check-box" />{action}</div>)}</div> : <p className="muted-copy">Ask a question to see suggested follow-ups.</p>}</section>
        </div>
      </div>
      <section className="panel archive-panel" aria-labelledby="archive-heading">
        <div className="panel-heading">
          <div><p className="eyebrow">Saved history</p><h2 id="archive-heading">Past transcripts</h2></div>
          <button className="archive-button" type="button" onClick={() => (archiveOpen ? setArchiveOpen(false) : void openArchive())}>{archiveOpen ? "Hide" : "Open"}</button>
        </div>
        {archiveOpen && (
          <>
            {archiveLoading && <p className="panel-status">Loading...</p>}
            {archiveError && <p className="error-banner" role="alert">{archiveError}</p>}
            {!archiveLoading && !archiveError && !archive.length && <p className="muted-copy">No transcripts saved yet. They are stored automatically while a meeting runs and when you press Stop.</p>}
            {shareLink && <p className="share-link">Anyone with this link can read that transcript - copied to your clipboard.<br /><a href={shareLink} target="_blank" rel="noreferrer">{shareLink}</a></p>}
            {!archiveEntry && archive.map((item) => (
              <div className="source-row" key={item.pathname}>
                <span className="source-time">{item.archived ? "final" : "live"}</span>
                <span><strong>{item.meetingId}</strong> - {new Date(item.savedAt).toLocaleString()}</span>
                <button className="archive-button" type="button" onClick={() => void openSaved(item.pathname)}>Read</button>
                <button className="archive-button" type="button" onClick={() => void shareSaved(item.pathname)}>Share link</button>
              </div>
            ))}
            {archiveEntry && (
              <>
                <p className="panel-status">{archiveEntry.meetingId} - {archiveEntry.entryCount} moments - saved {new Date(archiveEntry.savedAt).toLocaleString()} <button className="archive-button" type="button" onClick={() => setArchiveEntry(null)}>Back</button></p>
                <div className="transcript-feed">{archiveEntry.entries.map((entry) => <article className="transcript-item" key={entry.id}><div className="transcript-meta"><strong>{entry.speaker}</strong><span>{entry.timeLabel}</span></div><p>{entry.text}</p></article>)}</div>
              </>
            )}
          </>
        )}
      </section>
      <footer className="footer"><span>Meeting-AI</span><span>Human in the loop - Nothing speaks or changes automatically</span></footer>
    </main>
  );
}
