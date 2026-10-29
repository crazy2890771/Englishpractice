# Fluency Lab: Your Personal Language Academy

A mobile-first PWA for learning **English** (CEFR A1–C2 framework) and **Mandarin Chinese** (HSK 3.0, levels 1–9 framework) on a fixed weekly schedule. It covers placement, lessons, spaced repetition, weakness tracking, unit tests, level exams with remediation, an AI tutor and a progress dashboard. The UI is in Thai, with English optional.

> **ภาษาไทยโดยสรุป:** แอปเรียนภาษาอังกฤษและภาษาจีนกลางบนมือถือ มีแบบทดสอบวัดระดับแยกตามทักษะ ตารางเรียนรายสัปดาห์ บทเรียน ทบทวนคำศัพท์ (SRS) ติดตามจุดอ่อน สอบประจำหน่วยและสอบเลื่อนระดับ ครูติวเตอร์ AI และหน้าพัฒนาการ ใช้งานได้โดยไม่ต้องมี API key: ข้อปรนัยตรวจได้จริง ส่วนงานพูด/เขียนจะได้ฟีดแบ็ก "โหมดเดโม" ที่ตรวจด้วยกฎ ซึ่งมีป้ายบอกชัดเจนว่าไม่ใช่ AI

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn-style components (Radix), lucide icons, Recharts, IBM Plex Sans Thai + Inter |
| Data | Supabase Postgres + Auth + Storage; Drizzle ORM; **row-level security on every table** |
| AI | Provider abstraction: Anthropic (Claude) or any OpenAI-compatible API; zod-validated JSON output |
| Speech | OpenAI Whisper STT / TTS when configured; otherwise the browser's Web Speech API; typing is always possible |
| Tests | Vitest (unit + integration against real Postgres), Playwright (mobile + desktop E2E) |

## Quick start (local)

Requirements: Node 20+, Docker (for the local Supabase stack).

```bash
npm install
npm run db:start            # starts local Supabase and prints the API URL + anon key
npm run db:reset            # applies supabase/migrations (schema, RLS, auth trigger, storage bucket)
cp .env.example .env.local  # paste the anon key printed by db:start
npm run db:seed             # loads the curriculum (24 units, 45 level exams, placement banks)
npm run dev                 # http://localhost:3000
```

Sign in with **"ลองใช้โดยไม่สมัคร · Try without an account"** (Supabase anonymous sign-in), or create an email account. A guest can attach an email later in *Profile*.

To enable real AI feedback, set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` in `.env.local`. `OPENAI_API_KEY` also enables server speech-to-text and text-to-speech.

## Scripts

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (next core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: engine unit tests, plus integration tests against the local database. Integration tests are **skipped** when the database is not running or not seeded. |
| `npm run test:e2e` | Playwright against a production server (`npm run build` first; starts `npm start` if nothing is listening on :3000) |
| `npm run content:check` | Structural validation of every exercise in `src/content` |
| `npm run build` | Production build |

## Architecture

```
src/
  app/                 routes: (auth) login/register · onboarding · (app) today, learn, practice,
                       progress, profile, placement/[lang], session/[id], review, conversation/[id]
    api/               route handlers: every handler authenticates, validates with zod, runs as the user
  content/             curriculum as typed data (units, exercises, exams, placement banks, weakness tags)
  languages/           language modules (en, zh): levels, framework notes, speech locales, tutor notes
  engine/              pure, tested logic: scoring, placement, planner, SRS, weakness, progression,
                       schedule, open-task rubric + demo evaluator
  ai/                  providers, structured JSON generation (zod + one repair pass), teacher prompts
  server/              services: sessions, placement, curriculum, vocab, weakness, today, tutor, analytics
  db/                  Drizzle schema (tables + RLS policies) and `asUser()` (per-request RLS)
supabase/migrations    generated schema + auth trigger, storage bucket and policies
tests/                 unit/ · integration/ · e2e/
```

**Security model.**
- The server talks to Postgres directly, but every learner query runs inside `asUser(userId, …)`. This opens a transaction that switches to the `authenticated` role and sets the verified JWT claims, so RLS (`auth.uid() = user_id`) applies to every read and write.
- Content tables are read-only for learners.
- The `anon` role has no table privileges.
- Recordings live in a private bucket with per-user folder policies.
- API keys are server-only.
- Integration tests check that user B cannot read, update, delete or insert user A's rows in **any** user table.

**Language modules.** To add a language, add a module in `src/languages/`, its content in `src/content/<id>/`, a placement bank and level exams. The engines are language-agnostic, apart from the normalisation and tokenisation hooks in `engine/scoring.ts`.

## Learning engine: rules

- **Placement** (`engine/placement.ts`): estimated separately for each of the 5 skills, and resumable.
  - The learner first describes their level (never studied → confident); this only picks the first question's level.
  - Objective skills use a staircase: 2 items per level, plus a third if the first two are split. The test stops when the result is bracketed or after 12 items.
  - Speaking and writing are estimated from 2 rubric tasks.
  - Every result shows a confidence level and its limitations, and is labelled as an unofficial app estimate.
- **Weekly schedule** (`engine/schedule.ts`):

  | Day | Lesson |
  |---|---|
  | Sun | English listening + speaking |
  | Mon | English reading + writing |
  | Tue | Chinese listening + speaking |
  | Wed | Chinese reading + writing |
  | Thu | English listening + speaking |
  | Fri | English reading + writing |
  | Sat | English + Chinese vocabulary and review |

  - "Today" is computed in the learner's time zone (default Asia/Bangkok).
  - Missed lessons from the last 7 days (never from before the learner started that language) are offered as optional make-ups, with no penalty.
  - Reminders: *Profile → Add to calendar* downloads an `.ics` file with one weekly recurring event per study day, at the chosen time, with an alarm.
  - Practice never counts as the scheduled lesson.
  - The schedule can be edited in Profile.
- **Lesson flow** (`engine/planner.ts`): warm-up → skill blocks → corrections & retry → mini assessment.
  - Items mix new material, consolidation and current weaknesses.
  - Writing and speaking blocks always end with a production task.
  - Lessons autosave, can be paused and resumed, have previous/next navigation, track active time and end with a summary.
- **Spaced repetition** (`engine/srs.ts`): SM-2 with documented adjustments.
- **Weaknesses** (`engine/weakness.ts`): a category becomes *active* only after 3 or more mistakes in 21 days, across 2 or more exercises and on 2 or more different days (one bad lesson is not a pattern). It moves through watching → active → improving → resolved, based on mastery over recent tagged attempts.
- **Progression** (`engine/progression.ts`):
  - A unit test unlocks after at least 4 practice items at 60% or more. The unit test passes at 70%.
  - A level exam unlocks once all units of the level are complete. To pass, all three must hold:
    - overall score of at least 80%;
    - every required section at 70% or more;
    - the mandatory performance task completed.
  - A failed exam creates a remediation plan. The required remediation sessions must be completed before a retake.
- **Scoring**: objective questions are scored deterministically on the server, and answers never reach the client before submission. Open answers are rubric-scored by AI (validated JSON), or by the labelled demo evaluator. Pronunciation is never scored.
  - The demo evaluator cannot read meaning: it caps "task completion" at 3/5, lowers it for answers that ignore the task's topic, shows a rough band instead of a percentage, and gives the learner a self-check list of the task's requirements.

## Status report (honest)

### Tested end-to-end
- **Playwright** (mobile Pixel 7 + desktop Chrome, production build, local Supabase):
  - guest sign-up → onboarding → English placement (one skill answered fully, others skipped) → results labelled unofficial;
  - Chinese "start from the beginning" → EN and ZH levels stored separately;
  - practice session with autosave and **resume after a reload** → finish → summary;
  - progress dashboard;
  - mobile bottom navigation;
  - profile preference save, schedule edit and data export;
  - signed-out redirect and API 401;
  - Chinese vocabulary practice, review page and EN/ZH progress switch;
  - no uncaught page errors.
- **Integration** (real Postgres with the Supabase auth schema):
  - RLS isolation across all user tables, RLS enabled on every table, `anon` sees nothing, cascade delete;
  - the signup trigger;
  - "today" follows the schedule in Asia/Bangkok;
  - a full scheduled lesson including corrections and summary, and the make-up list updating;
  - demo evaluation of writing;
  - SRS review;
  - unit lock;
  - unit practice → unit test → next unit;
  - level exam fail → remediation → retake → pass → advance to A2;
  - cross-user session access denied;
  - demo tutor conversation.
- **Unit**: scoring and normalisation, SRS, weakness rules, adaptive placement (simulated learners), planner, progression and exam rules, schedule and time zones, demo rules (EN/ZH), and content validity (all ~1,400 exercises).

### Mocked / demo (clearly labelled in the UI)
- Without API keys, writing, speaking, placement open tasks and the tutor use **rule-based demo feedback**, marked "โหมดเดโม / not AI".
- Real Anthropic/OpenAI calls, server STT/TTS and AI-generated practice are implemented but **were not exercised in tests**, because no API key was available in the build environment.
- Browser speech recognition and voices depend on the device. The automated tests used the typing fallback.

### Not implemented yet
- Curriculum content for **English C2** and **HSK 5–9**. The levels exist in the framework, but the app shows "content coming" for them.
- Pronunciation or phoneme-level assessment, and real-time voice conversation.
- Push notifications. Reminders work through the calendar (.ics) export instead.
- Offline learning. The PWA is installable and shows an offline page, but lessons need a connection.
- Recording upload has not been covered by an automated test.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase Cloud + Vercel.
