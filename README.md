# English Fluency Lab

A 30-day, 60-minutes-a-day English program for intermediate (B1–B2) learners, built with Next.js, TypeScript, Tailwind CSS, PostgreSQL/Prisma and Recharts. It trains **speaking, listening, writing, pronunciation (shadowing) and conversational confidence**, with structured AI feedback, spaced-repetition review and progress analytics.

It runs fully in **demo mode with no API keys** (rule-based feedback + browser speech), and switches to **live AI mode** when server-side provider keys are configured.

---

## Features

| Area | What you get |
|---|---|
| **AI Speaking Partner** | Turn-based voice conversations on daily life, hobbies, travel, work, aviation and interviews. One question at a time, adaptive follow-ups, original → corrected → natural version, short explanations, scores, “Save to Mistakes”, optional interruption-free mode. |
| **Listening Challenge** | 60 dialogues (standard + challenge per day) in US/UK/Australian/Indian accents, adjustable speed, audio-first with transcript revealed after answering, MCQ / fill-in / inference questions with explanations, adaptive difficulty. |
| **Writing Coach** | Daily 100–150-word prompts (diary, opinion, email, story, professional), highlighted errors, corrections, natural rewrite, rubric scores, recurring weaknesses, saved history. |
| **Real-Life Roleplay** | 12 scenarios (interviews, hotels, airports, colleagues, customer service, aviation) with in-character AI, objectives, difficulty filter and an end-of-scenario rating for appropriateness, clarity and naturalness. |
| **Shadowing Trainer** | Model audio → record → word-level comparison (missed / different / extra words) and a pace estimate. Honest about limits: it's speech-recognition based, **not** a phoneme-level pronunciation score. |
| **Mistake Review** | Mistakes from every mode collected automatically, grouped by grammar / vocabulary / pronunciation / expression, reviewed with SM-2 spaced repetition. **Mastered only after 3 successful reviews spread over days.** |
| **30-day program** | 30 unique lessons in 4 weeks (Foundation → Natural Communication → Real-World English → Fluency Challenge), each with objectives, speaking, listening, writing, shadowing, vocabulary, review tasks and completion criteria. |
| **Assessments** | Day 1 baseline and Day 30 final use the **same tasks, rubric and scorer**, so the comparison is fair. |
| **Progress** | Study time, streaks, weekly activity, skill estimates, trends, weekly reports, Day 1 vs Day 30 radar chart. |

### The 15 pages

`/welcome` (+ `/onboarding`, `/login`, `/register`) · `/assessment` · `/dashboard` · `/calendar` · `/lesson/[day]` · `/speaking` · `/listening` · `/writing` · `/roleplay` · `/shadowing` · `/mistakes` · `/vocabulary` · `/progress` · `/progress/compare` · `/settings`

### Daily flow (60 min)

Speaking 20 → Listening 15 → Writing 10 → Shadowing 10 → Mistake review 5, with a session timer (pause/resume), step progress, save-and-resume and a daily completion summary.

**Completion is evidence-based, never time-based.** The server checks the database for each step: e.g. *N learner turns in today's conversation*, *a listening score ≥ the pass mark (or two full attempts)*, *a submission of ≥ 100 words*, *all 5 shadowing sentences attempted*, *5 review items done (or an empty queue)*.

---

## Quick start

Requirements: **Node 20+** (22 recommended) and **PostgreSQL 14+**.

```bash
git clone <repo> && cd english-fluency-lab
cp .env.example .env            # set DATABASE_URL and SESSION_SECRET
npm install                     # also runs `prisma generate`
npx prisma migrate deploy       # create tables
npm run db:seed                 # optional: demo login demo@fluencylab.local / fluency-demo-2026
npm run dev                     # http://localhost:3000
```

Click **Try the demo** on the welcome page for an instant private demo account, or create a normal account.

> Microphone access requires HTTPS (or `localhost`). On a phone, test against a deployed HTTPS URL or a tunnel.

### Local PostgreSQL in one line (Docker)

```bash
docker run -d --name efl-db -e POSTGRES_USER=efl -e POSTGRES_PASSWORD=efl -e POSTGRES_DB=efl -p 5432:5432 postgres:16
```

---

## Demo mode vs live AI mode

| | Demo mode (no keys) | Live mode |
|---|---|---|
| Feedback | Deterministic rule-based checker for ~30 common B1–B2 errors (designed **not** to over-correct) + measurable rubric heuristics | LLM (Anthropic Claude or any OpenAI-compatible API) returning JSON validated with Zod |
| Conversation | Lesson-scripted questions, elaboration prompts for short answers; roleplay characters follow scripted lines | Fully adaptive, in-character |
| Speech-to-text | Browser Web Speech API where available, otherwise typing | Server-side Whisper (OpenAI-compatible) |
| Text-to-speech | Browser `speechSynthesis` voices by accent | Server TTS with a shared DB cache |

Everything shown in demo mode is labelled **“Demo · rule-based”**. In live mode nothing is fabricated: if a provider fails, the user sees an error with **Retry** (their text is kept) and can always fall back to typing or reading.

### Configure providers (`.env`)

```bash
# Anthropic for feedback
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5-5

# OpenAI (or compatible) — enables server STT + TTS, and can also be the LLM
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

`AI_LLM_PROVIDER`, `AI_STT_PROVIDER`, `AI_TTS_PROVIDER` choose defaults (`auto` picks the first configured). Learners can pick among *configured* providers in **Settings**. Keys are read only in server modules (`src/lib/env.ts` imports `server-only`) and never prefixed with `NEXT_PUBLIC_`.

---

## Architecture

```
src/
  app/
    (public)/            welcome, login, register
    onboarding/          first-run wizard (name, goal, mic check, recording consent)
    (app)/               authenticated pages (layout validates the session)
    api/                 route handlers (auth, conversations, writing, listening, shadowing,
                         review, lessons, study, ai/stt, ai/tts, recordings, assessment, settings, account)
  components/
    audio/               VoiceInput (record → transcribe → review → send), Waveform
    practice/            ConversationRoom, ListeningExercise, WritingStudio, ShadowingTrainer, ReviewSession
  content/               30 lessons, roleplays, topic banks, assessment (typed, versioned)
  lib/
    ai/                  providers (anthropic, openai, http w/ timeout+retry), prompts, Zod schemas + rubrics, engine
    feedback/            demo rule engine + rubric heuristics
    client/              fetch wrapper, audio (MediaRecorder, SpeechRecognition, TTS), study-time tracker
    srs.ts progress.ts analytics.ts usage.ts rate-limit.ts auth.ts …
prisma/                  schema, migrations, seed
tests/unit               Vitest (rules, scoring, SRS, diffing, curriculum integrity, demo engine)
tests/e2e                Playwright (all pages × desktop/iPad/iPhone, full Day 1 lesson, assessment)
```

**AI feedback engine.** Every eligible speaking/writing response yields: original, corrected, more natural version, categorised items with brief explanations, suggested vocabulary, a follow-up exercise and rubric scores (grammar, vocabulary, fluency/clarity/coherence, task completion; bands 1–5). Model output is parsed and validated with Zod; invalid output triggers one automatic repair request, then a clear error. The same rubric text is embedded in every prompt and shown in the UI (“How scores work”). Scores are labelled as estimates — **not certified CEFR or pronunciation assessments**.

**Audio.** Turn-based and reliable first: permission errors (incl. iOS Settings hint), HTTPS checks, Safari's `audio/mp4` vs Chrome's `audio/webm`, a user-gesture audio unlock for iOS autoplay rules, timeouts, cancellation (`AbortController` end-to-end), retry, and a text-only fallback everywhere. Real-time streaming voice is a deliberate later enhancement.

**Privacy.** Recordings are stored only after explicit consent (onboarding or Settings), are private to their owner, expire after a configurable retention period, and can be deleted individually or all at once. Withdrawing consent deletes them. Learners can delete transcripts, reset progress, delete their account, or export all data as JSON.

**Security & cost.** Server-side sessions (random token, SHA-256-hashed in DB, httpOnly cookie), bcrypt passwords, Zod validation on every input, ownership checks on every record, per-user burst rate limiting, daily request caps and monthly cost budgets (server caps; users can only lower them), security headers, and a microphone-only `Permissions-Policy`.

**PWA.** Installable (manifest + icons). The service worker caches static assets and previously visited pages/read-only API responses; offline you get cached lessons and saved writing drafts. AI, STT and TTS require a connection.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright (starts `npm start` on port 3100; run `npm run build` first) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Create the demo login |
| `npx tsx scripts/cleanup.ts` | Purge expired recordings/sessions (schedule daily) |
| `node scripts/generate-icons.mjs` | Re-render PWA PNG icons from `public/icons/icon.svg` |

If Playwright can't download browsers in your environment, point it at an existing Chromium with `CHROMIUM_PATH=/path/to/chrome`.

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
