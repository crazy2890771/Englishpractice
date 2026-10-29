# Deployment: Supabase Cloud + Vercel

## 1. Supabase project

1. Create a project at supabase.com and note the region you chose.
2. **Authentication → Sign In / Providers**:
   - enable *Email*;
   - enable **Allow anonymous sign-ins** (needed for "Try without an account");
   - set the *Site URL* to your Vercel URL, and add `https://<your-domain>/auth/callback` to the redirect URLs.
3. Apply the migrations from this repository:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies supabase/migrations/*
   ```

   This creates:
   - all tables, with RLS enabled and policies applied;
   - the `handle_new_user` trigger (profile, languages, default schedule);
   - the private `recordings` storage bucket and its policies;
   - revoked privileges for the `anon` role.
4. Load the curriculum. Use the **direct** connection string here, not the pooler:

   ```bash
   DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run db:seed
   ```

   Re-run it after any content change; it is idempotent.

## 2. Vercel

1. Import the repository. The framework is detected as Next.js.
2. Set the environment variables (Production and Preview):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon / publishable key |
   | `DATABASE_URL` | Database → Connection string → **Transaction pooler** (port 6543) |
   | `AI_PROVIDER` | `auto`, `anthropic`, `openai` or `none` |
   | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional; leave both empty to run in labelled demo mode |
   | `AI_MAX_DAILY_REQUESTS`, `AI_RATE_LIMIT_PER_MINUTE` | per-user AI limits (defaults 300 and 20) |

3. Deploy, then open the site on your phone and use **Add to Home Screen** to install the PWA.

## 3. Checks after deploying

- Sign in as a guest. Onboarding should create a profile and the default schedule.
- Start the placement test and answer one item. This confirms that the DB connection and RLS work.
- *Profile → Export my data* should download a JSON file.

## Notes

- The server never uses the Supabase service-role key. Learner queries run as the `authenticated` role with the user's verified id, so RLS always applies.
- `DATABASE_URL` must be a role that can `SET ROLE authenticated` (the default `postgres` user can).
- Account deletion removes storage objects and then the `auth.users` row; all learner data cascades from it.
- The microphone requires HTTPS, which Vercel provides.
