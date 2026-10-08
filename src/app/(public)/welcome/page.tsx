import Link from "next/link";
import { redirect } from "next/navigation";
import { AudioLines, Headphones, MessageSquareText, Mic, NotebookPen, PenLine } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { MountainScene } from "@/components/scenery";
import { DemoButton } from "./demo-button";

export const metadata = { title: "Welcome" };

const FEATURES = [
  { icon: Mic, title: "AI Speaking Partner", text: "Natural conversations, one question at a time, with corrections after each answer." },
  { icon: Headphones, title: "Listening Challenge", text: "Realistic dialogues in US, UK, Australian and Indian accents at your speed." },
  { icon: PenLine, title: "Writing Coach", text: "Daily 100–150 word tasks with corrections and a natural rewrite." },
  { icon: MessageSquareText, title: "Real-Life Roleplay", text: "Interviews, hotels, airports, colleagues and aviation scenarios." },
  { icon: AudioLines, title: "Shadowing Trainer", text: "Repeat native-style sentences and see which words you missed." },
  { icon: NotebookPen, title: "Mistake Review", text: "Every mistake is collected and reviewed with spaced repetition." },
];

export default async function Welcome() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? "/dashboard" : "/onboarding");
  return (
    <div className="min-h-dvh">
      <section className="relative isolate overflow-hidden">
        <MountainScene className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
          <header className="flex items-center justify-between text-white">
            <Logo />
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
              Sign in
            </Link>
          </header>
          <div className="mt-16 max-w-2xl text-white sm:mt-24">
            <p className="text-sm font-medium text-white/80">30 days · 60 minutes a day · B1–B2</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              A more fluent <span className="text-blue-300">you</span>
              <br />
              is closer than <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">you think.</span>
            </h1>
            <p className="mt-4 text-lg text-white/80">Practice. Make mistakes. Improve. Repeat.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <DemoButton />
              <Link href="/register" className="btn rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base text-white backdrop-blur hover:bg-white/20">
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold">Six ways to train, every day</h2>
        <p className="mt-1 text-muted">A balanced daily plan: speaking 20 min, listening 15, writing 10, shadowing 10, review 5.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted">
          Scores in this app are estimates for self-study and are not certified CEFR or pronunciation assessments.
        </p>
      </section>
    </div>
  );
}
