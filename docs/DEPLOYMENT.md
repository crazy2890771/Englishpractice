# Deployment guide

English Fluency Lab is a standard Next.js (Node runtime) app with a PostgreSQL database. Any host that runs Node 20+ and offers HTTPS works.

## 1. Provision PostgreSQL

Any managed Postgres works (Neon, Supabase, RDS, Railway, Render…). Copy the connection string into `DATABASE_URL`. Use `?sslmode=require` if your provider requires TLS.

## 2. Environment variables

Set these in your host's dashboard (see `.env.example` for all options):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `SESSION_SECRET` | ✅ | Long random string: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | – | Leave empty for demo mode |
| `OPENAI_BASE_URL` | – | For OpenAI-compatible providers |
| `AI_MAX_DAILY_REQUESTS`, `AI_MAX_MONTHLY_COST_CENTS`, `AI_RATE_LIMIT_PER_MINUTE` | – | Cost controls (per user) |
| `LLM_INPUT_CENTS_PER_1K`, `LLM_OUTPUT_CENTS_PER_1K`, `STT_CENTS_PER_MINUTE`, `TTS_CENTS_PER_1K_CHARS` | – | Price estimates used for budget enforcement — set them to your provider's prices |

Never add `NEXT_PUBLIC_` to any key.

## 3. Build & migrate

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # listens on $PORT (default 3000)
```

Optionally `npm run db:seed` to create a demo login.

### Vercel

1. Import the repository. Framework preset: Next.js.
2. Add the environment variables above.
3. Build command: `npx prisma migrate deploy && npm run build`.
4. Audio uploads are limited by the platform's request-size limit (4.5 MB on Vercel serverless) — keep `MAX_AUDIO_BYTES` at or below it (answers are ≤ 2 minutes by default, typically < 1 MB).

### Docker / VM / Render / Railway / Fly.io

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD npx prisma migrate deploy && npm start
```

## 4. Scheduled maintenance

Run daily to enforce recording retention and clean expired sessions:

```bash
npx tsx scripts/cleanup.ts
```

(Expired recordings are also purged lazily whenever a learner uploads or lists recordings.)

## 5. Scaling notes

- The burst rate limiter is in-memory (per instance). For multiple instances, swap `src/lib/rate-limit.ts` for Redis/Upstash; daily/monthly caps are already database-backed.
- Recordings are stored in Postgres (`bytea`) for simplicity and access control. For large deployments, move them to object storage (S3/R2) with signed URLs — only `src/app/api/recordings/*` needs to change.
- The TTS cache is shared across users (identical lesson sentences are synthesised once).

## 6. Production checklist

- [ ] HTTPS enabled (required for microphone access, especially iOS Safari)
- [ ] `SESSION_SECRET` set to a strong random value
- [ ] Provider keys set server-side only; budgets configured
- [ ] `prisma migrate deploy` run on each release
- [ ] Daily `scripts/cleanup.ts` job scheduled
- [ ] Test on desktop Chrome/Safari, iPad Safari and iPhone Safari (mic permission prompt, autoplay unlock, “Add to Home Screen”)
