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

The repository contains both a deterministic demo mode and live-provider adapters. Demo mode does not connect to a real meeting. Live mode requires valid Vexa and Anthropic environment variables and a production deployment.

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
VEXA_BOT_API_KEY=your-vexa-bot-key
VEXA_TRANSCRIPTION_API_KEY=your-vexa-transcription-key
```

Create both hosted Vexa keys at [vexa.ai/account](https://vexa.ai/account): a Bot Key sends the notetaker to Google Meet, and a Transcription Key reads the transcript.


### Anthropic

The intended live provider is the Anthropic API, not Claude Code CLI:

```env
LLM_MODE=live
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_API_KEY=your-anthropic-api-key
LLM_MODEL=claude-sonnet-4-20250514
```

The live adapter calls Anthropic’s `/messages` endpoint. It does not invoke Claude Code CLI or any local shell command.

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
- `POST /api/meeting/{meetingId}/ask` — loads the transcript server-side and asks Claude about it.
- `POST /api/meeting/{meetingId}/stop` — stops the Vexa bot.

## Important limitations before production use

- Production authentication is a shared access code, not individual user accounts.
- Rate limiting is best-effort in serverless memory; use a durable rate limiter before exposing this publicly at scale.
- Transcript retention, redaction, and audit logging are not yet implemented.
- Google Meet may place the Vexa bot in a waiting room; the host must admit it.
- The assistant is intentionally silent. It only responds in the side panel after a user asks a question.
