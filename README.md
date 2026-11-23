# Studyflow

Studyflow is a student study workspace with an optional Node.js API for source-grounded AI explanations, organization, quizzes, follow-up chat, and document extraction. Notes and profiles are stored in the browser's local storage. API keys stay on the server.

## Requirements

- Node.js 18.11 or newer (includes `fetch` and the optional `--watch` dev mode)
- An OpenAI-compatible API key for live AI features (optional; local demo mode works without one)

## Run locally

```powershell
npm install
Copy-Item .env.example .env
```

Set `OPENAI_API_KEY` in `.env` to enable AI. The example configuration uses Gemini's OpenAI-compatible endpoint and `gemini-3.5-flash-lite`; set `OPENAI_MODEL` and `OPENAI_BASE_URL` to match another OpenAI-compatible provider. `PORT` defaults to `8080`.

```powershell
npm start
```

Open [http://localhost:8080](http://localhost:8080). Do not open `index.html` directly: the API and document upload features require the server. When no key is configured or the API is unreachable, the app clearly switches to local demo processing.

## API

- `GET /api/health` — reports whether AI is configured (never returns a key).
- `POST /api/organize` — JSON `{notes, studentName?, degree?, studyGoal?, studyPreset?, institution?, course?, level?, assessmentType?, rubric?, pastPaper?}`.
- `POST /api/explain` — JSON `{topic, context, sections?, ...study profile}`.
- `POST /api/quiz` — JSON `{topic, context, ...study profile}`.
- `POST /api/chat` — JSON `{question, context, ...study profile}`.
- `POST /api/upload` — multipart form with `file`; supports PDF, TXT, DOCX, and Markdown up to 12 MB. Text extraction is capped at 60,000 characters. Scanned PDFs without a text layer need OCR first.

All AI endpoints use the configured server-side OpenAI-compatible chat-completions API. The browser never receives the API key. Keep `.env` private and do not commit it.

Topics and study profiles are saved in browser local storage. Use the profile menu to export or import a workspace backup, or download a topic as a Markdown study sheet. Backups are needed to move data between devices; Studyflow does not sync browser storage. When AI is enabled, note text and the relevant study profile are sent to the configured provider to answer the request; Studyflow does not persist API request content on the server.

## Deploy to Vercel

Deploy the project from its repository root. For Gemini, add `OPENAI_API_KEY`, `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, and `OPENAI_MODEL=gemini-3.5-flash-lite` as Vercel environment variables. Do not deploy the local `.env` file. Vercel serves files from `public/` and routes `/api/*` to the exported Express app in `server.js`. Workspace data remains in each student's browser; use the JSON backup to transfer it between devices.
