# Meeting-AI

Meeting-AI is a browser-based, silent meeting assistant. Vexa joins a Google Meet, captures and transcribes the conversation, and Claude answers questions about the transcript in a side panel.

The assistant does not speak automatically, interrupt the meeting, send messages, or take actions without a person asking.

## Intended meeting flow

1. The host opens the Meeting-AI Vercel URL.
2. The host pastes the full Google Meet link, for example `https://meet.google.com/abc-defg-hij`.
3. Meeting-AI asks Vexa to send a notetaker bot to that meeting.
4. The host admits the bot from the Google Meet waiting room.
5. Vexa captures the meeting audio and creates a live transcript.
6. Participants open the same URL on their phones or computers.
7. Participants ask questions in the side panel.
8. Claude answers from the meeting transcript and shows supporting transcript sources.

The host must tell participants that the meeting is being recorded/transcribed and obtain any consent required by local law or company policy.

## Current status

The repository currently contains a working demo UI and demo transcript flow. Demo mode does not connect to a real meeting. The live Vexa bot/transcript integration and direct Anthropic Messages API adapter are the next implementation steps required for real meetings.

## Local demo

Requirements: Node.js 20+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

PowerShell users can use:

```powershell
Copy-Item .env.example .env.local
```

Open [http://localhost:3000](http://localhost:3000). Demo access code: `demo-access`.

Useful checks:

```bash
npm run validate
npm run typecheck
npm run build
```

## Environment variables

Never commit `.env.local` or provider credentials. Add production secrets in Vercel Project Settings → Environment Variables.

### Access

```env
ACCESS_CODE=choose-a-code-users-can-type
SESSION_SECRET=use-a-long-random-secret
```

### Vexa

For the hosted Vexa service:

```env
VEXA_MODE=live
VEXA_BASE_URL=https://api.cloud.vexa.ai
VEXA_API_KEY=your-vexa-api-key
```

Get a hosted Vexa API key at [vexa.ai/account](https://vexa.ai/account). Vexa’s API sends the bot to the meeting and provides transcript data. The Vexa service is external to Vercel and must be reachable over HTTPS.

### Anthropic

The intended live provider is the Anthropic API, not Claude Code CLI:

```env
LLM_MODE=live
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_API_KEY=your-anthropic-api-key
LLM_MODEL=claude-sonnet-4-20250514
```

The live adapter must call Anthropic’s `/messages` endpoint. The current demo adapter still uses the OpenAI-compatible `/chat/completions` shape, so live Anthropic mode is not complete yet.

## Vercel deployment

1. Import this repository into Vercel.
2. Use the default Next.js settings.
3. Add the access, Vexa, and Anthropic environment variables.
4. Keep provider keys server-side; never use `NEXT_PUBLIC_` for them.
5. Deploy and share the generated `.vercel.app` URL.

Users do not need to install Vexa, Claude, or Meeting-AI. They only need the Vercel link and the Meeting-AI access code.

## API routes

- `POST /api/session` — validates the meeting access code and creates a session.
- `GET /api/meeting/{meetingId}/transcript` — loads transcript context.
- `POST /api/meeting/{meetingId}/ask` — asks the configured LLM about the transcript.

## Important limitations before production use

- The current repository is a demo until the live Vexa and Anthropic adapters are finished.
- Production authentication, meeting/session binding, rate limits, transcript retention, redaction, and audit logging still need to be hardened.
- Google Meet may place the Vexa bot in a waiting room; the host must admit it.
- The assistant is intentionally silent. It only responds in the side panel after a user asks a question.
