# Studyflow

A source-grounded AI study workspace that turns raw university lecture notes (`PDF`, `DOCX`, `TXT`, `MD`) into structured study guides, active-recall flashcards, and scored quizzes—without hallucinating outside your syllabus.

**Live Demo:** [studyflow-web-alpha.vercel.app](https://studyflow-web-alpha.vercel.app)

---

## Why I Built It
Paste lecture notes into a normal chatbot and two things happen: it mixes your professor's syllabus with outside internet facts, and everything gets buried in an endless chat scroll. I built Studyflow to solve both—enforcing strict source-grounding on the backend and returning validated JSON schemas that render as interactive study modules.

## Key Features
- **Document Extraction Pipeline:** Upload `PDF`, `DOCX`, `TXT`, or Markdown files (up to 12 MB / 60,000 chars) parsed server-side via `Multer`, `pdf-parse`, and `mammoth`.
- **Source-Grounded AI Outputs:** Enforces system-prompt boundaries and structured JSON responses for topic breakdowns, section-cited explanations, flashcards, and multiple-choice quizzes.
- **Persistent Student Profile:** Saves courses, rubrics, and study progress in `localStorage` with one-click JSON backup export/import and Markdown study sheet downloads.
- **Offline / Demo Fallback:** Automatically switches to deterministic local note splitting and quiz generation if no API key is configured or the upstream endpoint spikes.

## Tech Stack
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (`localStorage` state management)
- **Backend:** Node.js, Express, Multer, `pdf-parse`, `mammoth`
- **AI & Deployment:** Gemini API (OpenAI-compatible endpoint), Vercel Serverless Functions

---

## Running Locally

**Prerequisites:** Node.js `18.11+`

1. **Clone & install dependencies:**
   ```bash
   git clone [https://github.com/StackOverThiago/studyflow-web.git](https://github.com/StackOverThiago/studyflow-web.git)
   cd studyflow-web
   npm install
