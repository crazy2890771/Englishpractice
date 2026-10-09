"use client";
import { useState, type ReactNode } from "react";
import { Download, LogOut, Play, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { applyTheme, type Theme } from "@/components/theme";
import { speak, unlockAudio } from "@/lib/client/audio";
import { Badge, ErrorBanner, Notice, Spinner } from "@/components/ui";
import { OfflineDownload } from "@/components/offline-download";

interface S {
  userId: string;
  theme: string;
  speechRate: number;
  accent: string;
  llmProvider: string;
  sttProvider: string;
  ttsProvider: string;
  saveRecordings: boolean;
  recordingRetentionDays: number;
  interruptionFree: boolean;
  dailyAiRequestLimit: number;
  monthlyCostLimitCents: number;
}

interface Props {
  initial: S;
  profile: { name: string; email: string | null; level: string; isDemo: boolean };
  providers: { resolved: { llm: string; stt: string; tts: string; mode: string }; llm: string[]; speech: string[] };
  caps: { dailyRequests: number; monthlyCostCents: number };
  usage: { requestsLast24h: number; costCentsThisMonth: number };
  lessonDays: number[];
  recordings: { id: string; mode: string; label: string | null; durationMs: number | null; createdAt: string; expiresAt: string; sizeBytes: number }[];
}

const LLM_LABEL: Record<string, string> = { auto: "Automatic", anthropic: "Anthropic Claude", openai: "OpenAI-compatible", mock: "Demo (rule-based)" };

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      <div>{children}{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}</div>
    </div>
  );
}

export function SettingsForm({ initial, profile, providers, caps, usage, lessonDays, recordings: initialRecs }: Props) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState(initialRecs);
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(patch: Partial<S>) {
    const prev = s;
    setS({ ...s, ...patch });
    setError(null);
    try {
      await api("/api/settings", { method: "PATCH", body: patch });
      setSaved("Saved");
      setTimeout(() => setSaved(null), 1500);
      if (patch.saveRecordings === false) setRecs([]);
    } catch (e) {
      setS(prev);
      setError(errorMessage(e));
    }
  }

  async function danger(scope: "recordings" | "transcripts" | "progress" | "account", confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(scope);
    try {
      await api("/api/account/data", { method: "DELETE", body: { scope } });
      if (scope === "account") window.location.href = "/welcome";
      else if (scope === "progress") window.location.href = "/dashboard";
      else {
        setRecs([]);
        setSaved("Deleted");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const providerFallback = (choice: string, available: string[]) => (choice !== "auto" && !available.includes(choice) ? "Not configured on the server — the app will fall back automatically." : undefined);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-16 z-10 h-6 md:top-2" aria-live="polite">
        {saved && <Badge tone="success" className="float-right">{saved}</Badge>}
      </div>
      {error && <ErrorBanner message={error} />}

      <Section title="Profile">
        <Field label="Name" htmlFor="name">
          <div className="flex gap-2">
            <input id="name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="btn-secondary" disabled={!name.trim() || name === profile.name} onClick={async () => { try { await api("/api/profile", { method: "PATCH", body: { name } }); setSaved("Saved"); } catch (e) { setError(errorMessage(e)); } }}>Save</button>
          </div>
        </Field>
        <Field label="Account" htmlFor="acct">
          <p id="acct" className="text-sm text-muted">{profile.isDemo ? "Demo account (data is stored but tied to this browser session)" : profile.email} · Level {profile.level}</p>
        </Field>
      </Section>

      <Section title="Appearance">
        <Field label="Theme" htmlFor="theme">
          <select id="theme" className="input" value={s.theme} onChange={(e) => { applyTheme(e.target.value as Theme); void save({ theme: e.target.value }); }}>
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Field>
      </Section>

      <Section title="Audio & speech" desc="Applies to the AI voice, listening dialogues and shadowing.">
        <Field label={`Speaking speed (${s.speechRate.toFixed(2)}x)`} htmlFor="rate">
          <div className="flex items-center gap-3">
            <input id="rate" type="range" min={0.5} max={1.5} step={0.05} value={s.speechRate} onChange={(e) => setS({ ...s, speechRate: Number(e.target.value) })} onPointerUp={() => save({ speechRate: s.speechRate })} onKeyUp={() => save({ speechRate: s.speechRate })} className="w-full accent-[rgb(var(--brand))]" />
            <button type="button" className="btn-secondary" onClick={() => { unlockAudio(); speak("Hi! This is how I'll sound in your conversations.", { rate: s.speechRate, accent: s.accent, provider: providers.resolved.tts as "openai" | "browser" }).catch((e) => setError(errorMessage(e))); }}>
              <Play className="h-4 w-4" aria-hidden /> Test
            </button>
          </div>
        </Field>
        <Field label="Preferred accent" htmlFor="accent" hint="Used for the AI voice. Listening dialogues keep their own accents.">
          <select id="accent" className="input" value={s.accent} onChange={(e) => save({ accent: e.target.value })}>
            <option value="US">American (US)</option>
            <option value="UK">British (UK)</option>
            <option value="AU">Australian</option>
            <option value="IN">Indian</option>
          </select>
        </Field>
        <Field label="Interruption-free conversations" htmlFor="if" hint="Hide feedback during conversations and show it all at the end.">
          <input id="if" type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={s.interruptionFree} onChange={(e) => save({ interruptionFree: e.target.checked })} />
        </Field>
      </Section>

      <Section title="Offline use" desc="Practise on a plane or with a weak signal. Re-download after finishing new lessons.">
        <OfflineDownload lessonDays={lessonDays} />
      </Section>

      <Section title="AI providers" desc="API keys are configured on the server (environment variables) and are never sent to your browser.">
        <Notice tone={providers.resolved.mode === "live" ? "info" : "warn"}>
          Currently using: <strong>{LLM_LABEL[providers.resolved.llm]}</strong> for feedback · <strong>{providers.resolved.stt === "openai" ? "server" : "browser"}</strong> speech recognition · <strong>{providers.resolved.tts === "openai" ? "server" : "browser"}</strong> voices.
          {providers.resolved.mode === "demo" && " Demo mode gives rule-based feedback that catches common errors only."}
        </Notice>
        <Field label="Feedback engine (LLM)" htmlFor="llm" hint={providerFallback(s.llmProvider, providers.llm)}>
          <select id="llm" className="input" value={s.llmProvider} onChange={(e) => save({ llmProvider: e.target.value })}>
            {["auto", "anthropic", "openai", "mock"].map((p) => <option key={p} value={p} disabled={p !== "auto" && !providers.llm.includes(p)}>{LLM_LABEL[p]}{p !== "auto" && !providers.llm.includes(p) ? " (not configured)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Speech-to-text" htmlFor="stt" hint={providerFallback(s.sttProvider, providers.speech)}>
          <select id="stt" className="input" value={s.sttProvider} onChange={(e) => save({ sttProvider: e.target.value })}>
            <option value="auto">Automatic</option>
            <option value="openai" disabled={!providers.speech.includes("openai")}>Server (Whisper){!providers.speech.includes("openai") ? " (not configured)" : ""}</option>
            <option value="browser">Browser speech recognition</option>
          </select>
        </Field>
        <Field label="Text-to-speech" htmlFor="tts" hint={providerFallback(s.ttsProvider, providers.speech)}>
          <select id="tts" className="input" value={s.ttsProvider} onChange={(e) => save({ ttsProvider: e.target.value })}>
            <option value="auto">Automatic</option>
            <option value="openai" disabled={!providers.speech.includes("openai")}>Server voices{!providers.speech.includes("openai") ? " (not configured)" : ""}</option>
            <option value="browser">Browser voices</option>
          </select>
        </Field>
      </Section>

      <Section title="Usage & cost limits" desc={`Server caps: ${caps.dailyRequests} AI requests/day and $${(caps.monthlyCostCents / 100).toFixed(2)}/month. Your limits can only be lower.`}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-2 p-3"><p className="text-muted">AI requests (24h)</p><p className="text-xl font-bold">{usage.requestsLast24h}</p></div>
          <div className="rounded-xl bg-surface-2 p-3"><p className="text-muted">Est. cost this month</p><p className="text-xl font-bold">${(usage.costCentsThisMonth / 100).toFixed(2)}</p></div>
        </div>
        <Field label="Daily request limit" htmlFor="dl">
          <input id="dl" type="number" min={0} max={10000} className="input" value={s.dailyAiRequestLimit} onChange={(e) => setS({ ...s, dailyAiRequestLimit: Number(e.target.value) })} onBlur={() => save({ dailyAiRequestLimit: Math.max(0, Math.round(s.dailyAiRequestLimit)) })} />
        </Field>
        <Field label="Monthly budget (cents)" htmlFor="ml">
          <input id="ml" type="number" min={0} max={100000} className="input" value={s.monthlyCostLimitCents} onChange={(e) => setS({ ...s, monthlyCostLimitCents: Number(e.target.value) })} onBlur={() => save({ monthlyCostLimitCents: Math.max(0, Math.round(s.monthlyCostLimitCents)) })} />
        </Field>
      </Section>

      <Section title="Privacy & recordings" desc="Recordings are only stored with your consent, are private to you and expire automatically.">
        <Field label="Save my recordings" htmlFor="rec" hint="Turning this off deletes all stored recordings.">
          <input id="rec" type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={s.saveRecordings} onChange={(e) => save({ saveRecordings: e.target.checked })} />
        </Field>
        <Field label="Keep recordings for" htmlFor="ret">
          <select id="ret" className="input" value={s.recordingRetentionDays} onChange={(e) => save({ recordingRetentionDays: Number(e.target.value) })}>
            {[7, 14, 30, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">Saved recordings ({recs.length})</p>
          {recs.length === 0 ? (
            <p className="text-sm text-muted">No recordings stored.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {recs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
                  <Badge>{r.mode.toLowerCase()}</Badge>
                  <span className="min-w-0 flex-1 truncate">{r.label ?? "Recording"}</span>
                  <audio controls preload="none" src={`/api/recordings/${r.id}`} className="h-8 w-48 max-w-full" />
                  <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Delete recording" onClick={async () => { setRecs((x) => x.filter((y) => y.id !== r.id)); await api(`/api/recordings/${r.id}`, { method: "DELETE" }).catch(() => {}); }}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Your data">
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" className="btn-secondary"><Download className="h-4 w-4" aria-hidden /> Export my data (JSON)</a>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => danger("recordings", "Delete all saved recordings?")}>{busy === "recordings" && <Spinner />} Delete recordings</button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => danger("transcripts", "Delete all conversations, transcripts, writing submissions and recordings? Lesson completion is kept.")}>{busy === "transcripts" && <Spinner />} Delete transcripts</button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="button" className="btn-danger" disabled={!!busy} onClick={() => danger("progress", "Reset ALL progress, mistakes, vocabulary and assessments? This cannot be undone.")}>Reset progress</button>
          <button type="button" className="btn-danger" disabled={!!busy} onClick={() => danger("account", "Permanently delete your account and all data?")}>Delete account</button>
          <button type="button" className="btn-ghost ml-auto" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/welcome"; }}><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
        </div>
      </Section>
    </div>
  );
}
