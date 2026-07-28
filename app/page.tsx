"use client";

import { FormEvent, useState } from "react";
import type { AnswerResult, TranscriptEntry } from "@/lib/types";

const initialMeetingId = "demo-meeting-001";

export default function Home() {
  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const [accessCode, setAccessCode] = useState("demo-access");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Enter the meeting code to load context.");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, accessCode }),
      });
      const sessionBody = await session.json();
      if (!session.ok) throw new Error(sessionBody.error || "Could not open meeting.");
      const transcriptResponse = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/transcript`);
      const transcriptBody = await transcriptResponse.json();
      if (!transcriptResponse.ok) throw new Error(transcriptBody.error || "Could not load transcript.");
      setTranscript(transcriptBody.entries);
      setStatus(`${transcriptBody.mode === "demo" ? "Demo" : "Vexa"} context loaded · ${transcriptBody.entries.length} moments`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setTranscript([]);
    } finally {
      setLoading(false);
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || !transcript.length) return;
    setAsking(true);
    setError("");
    try {
      const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, transcript }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not answer question.");
      setAnswer(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">◌</span><span>quietline</span></div>
        <div className="topbar-note"><span className="status-dot" /> silent by design</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Meeting companion / prototype</p>
          <h1>Stay in the room.<br /><em>Keep your hands free.</em></h1>
          <p className="lede">A quiet layer for live context. Ask questions, find the moment, and leave with a short list of what matters.</p>
        </div>
        <div className="hero-badge"><span>●</span> No audio capture<br /><small>No automated actions</small></div>
      </section>

      <form className="access-card" onSubmit={unlock}>
        <div className="field-group"><label htmlFor="meeting-id">Meeting ID</label><input id="meeting-id" value={meetingId} onChange={(event) => setMeetingId(event.target.value)} placeholder="team-sync-042" /></div>
        <div className="field-group"><label htmlFor="access-code">Access code</label><input id="access-code" type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="••••••••" /></div>
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Opening…" : "Open meeting"}<span>↗</span></button>
      </form>

      {error && <p className="error-banner" role="alert">{error}</p>}

      <div className="workspace-grid">
        <section className="panel transcript-panel" aria-labelledby="transcript-heading">
          <div className="panel-heading"><div><p className="eyebrow">Live context</p><h2 id="transcript-heading">Transcript</h2></div><span className="mode-pill">{transcript.length ? "● connected" : "○ waiting"}</span></div>
          <p className="panel-status">{status}</p>
          <div className="transcript-feed">
            {transcript.length ? transcript.map((entry) => <article className="transcript-item" key={entry.id}>
              <div className="transcript-meta"><strong>{entry.speaker}</strong><span>{entry.timeLabel}</span></div>
              <p>{entry.text}</p>
            </article>) : <div className="empty-state"><span className="empty-icon">✦</span><strong>Your meeting context will appear here.</strong><p>Use the demo code above to load a sample conversation.</p></div>}
          </div>
        </section>

        <div className="right-column">
          <section className="panel ask-panel" aria-labelledby="ask-heading">
            <div className="panel-heading"><div><p className="eyebrow">Ask quietly</p><h2 id="ask-heading">What do you need?</h2></div><span className="keyboard-hint">⌘ ↵</span></div>
            <form onSubmit={ask}>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!transcript.length || asking} placeholder={transcript.length ? "Who owns the follow-up?" : "Open a meeting to start asking…"} rows={3} />
              <div className="ask-footer"><span>Answers stay grounded in this transcript.</span><button className="ask-button" type="submit" disabled={!transcript.length || !question.trim() || asking}>{asking ? "Thinking…" : "Ask"} <span>↗</span></button></div>
            </form>
          </section>

          <section className="panel answer-panel" aria-labelledby="answer-heading">
            <div className="panel-heading"><div><p className="eyebrow">Assistant</p><h2 id="answer-heading">Answer</h2></div>{answer && <span className="mode-pill">{answer.mode}</span>}</div>
            {answer ? <>
              <p className="answer-copy">{answer.answer}</p>
              <div className="subsection"><h3>Sources</h3>{answer.sources.map((source) => <div className="source-row" key={source.id}><span className="source-time">{source.timeLabel}</span><span><strong>{source.speaker}</strong> · {source.text}</span></div>)}</div>
            </> : <div className="answer-placeholder"><span>↳</span><p>Your answer and the moments behind it will land here.</p></div>}
          </section>

          <section className="panel actions-panel" aria-labelledby="actions-heading">
            <div className="panel-heading"><div><p className="eyebrow">Proposed, not automatic</p><h2 id="actions-heading">Action items</h2></div><span className="count-pill">{answer?.actions.length ?? 0}</span></div>
            {answer?.actions.length ? <div className="action-list">{answer.actions.map((action) => <div className="action-row" key={action}><span className="check-box" />{action}</div>)}</div> : <p className="muted-copy">Ask a question after opening the meeting to see suggested follow-ups.</p>}
          </section>
        </div>
      </div>
      <footer className="footer"><span>Quietline prototype</span><span>Human in the loop · Nothing is sent or changed automatically</span></footer>
    </main>
  );
}
