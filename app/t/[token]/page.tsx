import { readShared } from "@/lib/store";

// Public, read-only. Anyone holding the link can read it; no access code.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const saved = await readShared(token).catch(() => null);
  return { title: saved ? `Transcript - ${saved.meetingId}` : "Transcript not found", robots: { index: false, follow: false } };
}

export default async function SharedTranscript({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const saved = await readShared(token).catch(() => null);

  if (!saved) {
    return (
      <main className="shell">
        <header className="topbar"><div className="brand"><span className="brand-mark">AI</span><span>meeting-ai</span></div></header>
        <section className="panel"><div className="empty-state"><span className="empty-icon">*</span><strong>This transcript link is not valid.</strong><p>It may have been removed, or the link may be incomplete.</p></div></section>
      </main>
    );
  }

  const saidBy = [...new Set(saved.entries.map((entry) => entry.speaker))];

  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">AI</span><span>meeting-ai</span></div><div className="topbar-note">read-only transcript</div></header>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Meeting transcript</p>
            <h2>{saved.meetingId}</h2>
          </div>
          <span className="mode-pill">{saved.entryCount} moments</span>
        </div>
        <p className="panel-status">
          Saved {new Date(saved.savedAt).toLocaleString()}
          {saidBy.length ? ` - ${saidBy.join(", ")}` : ""}
        </p>
        <div>
          {saved.entries.map((entry) => (
            <article className="transcript-item" key={entry.id}>
              <div className="transcript-meta"><strong>{entry.speaker}</strong><span>{entry.timeLabel}</span></div>
              <p>{entry.text}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="footer"><span>Meeting-AI</span><span>Shared read-only - anyone with this link can read it</span></footer>
    </main>
  );
}
