# Quietline — silent meeting assistant prototype

Quietline is a small, demo-first meeting companion for a browser. A participant enters a meeting ID and access code, loads transcript context, asks a question, and sees a grounded answer, transcript sources, and proposed action items.

The prototype is intentionally quiet: it does not capture audio, transcribe speech, send messages, update task systems, or take autonomous actions.

## Local run

Requirements: Node.js 20+ and npm.

```bash
npm install
copy .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default demo access code is `demo-access`. The demo transcript loads without any external credentials.

Useful checks:

```bash
npm run validate
npm run typecheck
npm run build
```

## Configuration

All settings are documented in `.env.example`. Never commit `.env.local` or provider credentials.

### Vexa setup

The Vexa adapter is in `lib/vexa.ts`. Demo mode is the default:

```env
VEXA_MODE=demo
```

For a Vexa-compatible HTTP service, set:

```env
VEXA_MODE=live
VEXA_BASE_URL=https://your-vexa-service.example
VEXA_API_KEY=your-key
```

The current adapter makes an authenticated `GET /meetings/{meetingId}/transcript` request and accepts a JSON array or an object containing `transcript` or `items`. Each record should include `text` and may include `id`, `speaker`, `timestamp`, `timeLabel`, and `source`. Adapt that one module if the deployed Vexa API uses a different route or response shape.

### LLM provider setup

Demo mode is the default and is deterministic:

```env
LLM_MODE=demo
```

Live mode uses an OpenAI-compatible HTTP chat-completions endpoint. It does not invoke a shell or vendor CLI:

```env
LLM_MODE=live
LLM_BASE_URL=https://your-provider.example/v1
LLM_API_KEY=your-key
LLM_MODEL=your-model
```

The adapter posts to `${LLM_BASE_URL}/chat/completions`. The interface is isolated in `lib/llm.ts`, so a future Claude Code CLI or Codex integration can be added behind a separate server-side adapter without changing the UI. Do not run arbitrary shells from Vercel functions.

## Vercel deployment

1. Import this repository into Vercel.
2. Use the default Next.js build settings.
3. Add `ACCESS_CODE` and a long random `SESSION_SECRET` in the project Environment Variables.
4. Leave both adapters in demo mode for a zero-credential preview, or add the Vexa/LLM variables above using the exact names shown. Do not prefix provider secrets with `NEXT_PUBLIC_`.
5. For live mode, `VEXA_BASE_URL` and `LLM_BASE_URL` must be externally reachable over HTTPS from Vercel Functions; a service bound only to `localhost` or a private local network will not work.
6. Deploy and open the generated URL. The browser uses same-origin API paths, and the responsive layout supports mobile access.

The app uses standard Next.js route handlers and does not require a database. Vercel environment variables are server-side by default because the provider variables are read only in API route modules.

## API routes

- `POST /api/session` — validates `{ meetingId, accessCode }` and sets an HTTP-only session cookie.
- `GET /api/meeting/{meetingId}/transcript` — returns demo or Vexa transcript entries.
- `POST /api/meeting/{meetingId}/ask` — accepts `{ question, transcript }` and returns an answer, sources, proposed actions, and adapter mode.

## Known limitations

- This is a prototype access gate, not production authentication. One shared access code is used; there are no users, roles, revocation, rate limits, CSRF tokens, or persistent sessions.
- The session cookie is signed and expires after eight hours, but meeting authorization is not persisted or tied to a Vexa identity.
- Demo mode uses a fixed five-entry transcript and deterministic answer logic; it is not a real language model.
- Live Vexa integration assumes one `GET` transcript endpoint and a small set of response shapes; provider-specific joining, bot lifecycle, polling, and reconnect behavior are not implemented.
- Live LLM responses are plain text. Sources are selected by simple transcript keyword matching, and live action-item extraction is not implemented.
- Transcript context is posted from the browser to the ask route on each question. There is no server-side transcript store, streaming, pagination, redaction, or retention policy.
- There is no automatic speech capture, browser recording, autonomous action execution, task-system integration, calendar integration, or notification delivery.
- The UI does not yet include production-grade observability, audit logging, abuse protection, or accessibility testing beyond basic semantic labels and responsive layout.
