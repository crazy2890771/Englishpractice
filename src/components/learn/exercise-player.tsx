"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientDialogue, ClientExercise, ClientPassage } from "@/server/dto";
import type { Response } from "@/engine/scoring";
import type { DiffToken } from "@/engine/scoring";
import type { OpenEvaluation } from "@/engine/open-eval";
import { RUBRIC, RUBRIC_KEYS } from "@/engine/open-eval";
import type { Line } from "@/content/types";
import { AudioPlayer } from "./audio-player";
import { PassageView, TranscriptView } from "./passage";
import { VoiceAnswer, type VoiceMeta } from "./voice-answer";
import { useL, usePrefs } from "@/components/app/ui-context";

export interface ExerciseResult {
  score: number;
  correct: boolean;
  expected: string | null;
  diff: DiffToken[] | null;
  evaluation: OpenEvaluation | null;
  explanationTh: string;
  explanationEn: string | null;
  transcript: Line[] | null;
  audioText: string | null;
  modelAnswer: string | null;
}

const INSTRUCTIONS: Record<ClientExercise["type"], [string, string]> = {
  mcq: ["เลือกคำตอบที่ถูกต้อง", "Choose the correct answer"],
  true_false: ["ข้อความนี้ถูกหรือผิด", "True or false?"],
  fill_blank: ["เติมคำในช่องว่าง", "Fill in the blank"],
  word_recall: ["พิมพ์คำศัพท์ที่ตรงกับความหมาย", "Type the word"],
  sentence_correction: ["แก้ประโยคให้ถูกต้อง (พิมพ์ทั้งประโยค)", "Correct the sentence (type the whole sentence)"],
  listen_type: ["ฟังแล้วพิมพ์ประโยคที่ได้ยิน", "Listen and type what you hear"],
  sentence_order: ["แตะคำเพื่อเรียงเป็นประโยค", "Tap the words to build the sentence"],
  match_pairs: ["จับคู่ให้ถูกต้อง", "Match the pairs"],
  open_writing: ["เขียนตอบตามโจทย์", "Write your answer"],
  speaking_response: ["พูดตอบคำถาม", "Answer by speaking"],
  repeat_sentence: ["ฟังแล้วพูดตาม", "Listen and repeat"],
};

function lengthOf(lang: string, text: string) {
  return lang === "zh" ? [...text].filter((c) => /[㐀-鿿]/.test(c)).length : text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function DiffView({ tokens, zh }: { tokens: DiffToken[]; zh: boolean }) {
  return (
    <p className={cn("flex flex-wrap gap-x-1 gap-y-1 text-base", zh && "zh gap-x-0.5")}>
      {tokens.map((t, i) =>
        t.kind === "match" ? (
          <span key={i} className="text-emerald-700">{t.ref}</span>
        ) : t.kind === "missed" ? (
          <span key={i} className="rounded bg-red-50 px-0.5 text-red-700 line-through">{t.ref}</span>
        ) : t.kind === "wrong" ? (
          <span key={i} className="rounded bg-amber-50 px-0.5 text-amber-800" title={t.said}>
            {t.ref}
            <sub className="ml-0.5 text-[10px]">{t.said}</sub>
          </span>
        ) : (
          <span key={i} className="rounded bg-secondary px-0.5 text-muted-foreground">+{t.said}</span>
        ),
      )}
    </p>
  );
}

export function EvaluationView({ ev, onRetry, retried }: { ev: OpenEvaluation; onRetry?: () => void; retried?: boolean }) {
  const L = useL();
  const [showCorrected, setShowCorrected] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ev.evaluator === "ai" ? "success" : "warning"}>{ev.evaluator === "ai" ? L("ประเมินโดย AI", "AI evaluation") : L("เดโม · ตรวจด้วยกฎ ไม่ใช่ AI", "Demo · rule-based, not AI")}</Badge>
        <span className="text-sm font-semibold">{Math.round(ev.score * 100)}%</span>
      </div>
      <p className="text-sm">{ev.comment}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {RUBRIC_KEYS[ev.kind].map((k) => (
          <div key={k} className="flex items-center gap-3 text-sm">
            <dt className="w-32 shrink-0 text-muted-foreground">{L(RUBRIC[k]!.th, RUBRIC[k]!.en)}</dt>
            <dd className="flex flex-1 gap-1" aria-label={`${ev.criteria[k]}/5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={cn("h-2 flex-1 rounded-full", n <= (ev.criteria[k] ?? 0) ? "bg-primary" : "bg-secondary")} />
              ))}
            </dd>
          </div>
        ))}
      </dl>
      {ev.kind === "speaking" && <p className="text-xs text-muted-foreground">{L("ไม่ได้ให้คะแนนการออกเสียง/วรรณยุกต์ เพราะประเมินจากข้อความถอดเสียงไม่ได้อย่างแม่นยำ", "Pronunciation/tones are not scored — they can't be judged reliably from a transcript.")}</p>}
      {ev.mistakes.length > 0 ? (
        <ul className="space-y-2">
          {ev.mistakes.map((m, i) => (
            <li key={i} className="rounded-xl bg-secondary/60 p-3 text-sm">
              <p>
                <span className="text-red-700 line-through decoration-red-300">{m.original}</span> <span aria-hidden>→</span> <span className="font-medium">{m.corrected}</span>
              </p>
              <p className="mt-1 text-muted-foreground">{m.explanation}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-emerald-700">{ev.evaluator === "ai" ? L("ไม่พบข้อผิดพลาดสำคัญ", "No important mistakes found.") : L("ไม่พบข้อผิดพลาดที่พบบ่อย (ระบบเดโมตรวจได้เฉพาะรูปแบบที่พบบ่อย)", "No common errors found (the demo checker only covers common patterns).")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {onRetry && !retried && (
          <Button size="sm" onClick={onRetry}>
            <RotateCcw /> {ev.retryPrompt}
          </Button>
        )}
        {(retried || !onRetry || ev.mistakes.length === 0) && ev.correctedVersion && ev.correctedVersion !== "" && (
          <Button size="sm" variant="outline" onClick={() => setShowCorrected((s) => !s)}>
            <Eye /> {L("ดูฉบับที่แก้แล้ว", "Show corrected version")}
          </Button>
        )}
      </div>
      {showCorrected && <p className="rounded-xl border bg-card p-3 text-sm whitespace-pre-wrap">{ev.correctedVersion}</p>}
    </div>
  );
}

export function ExercisePlayer({
  exercise: ex,
  material,
  languageId,
  ttsLang,
  sttLang,
  result,
  onSubmit,
  draft,
  onDraft,
  hideFeedback,
}: {
  exercise: ClientExercise;
  material?: ClientDialogue | ClientPassage | null;
  languageId: string;
  ttsLang: string;
  sttLang: string;
  result?: ExerciseResult | null;
  onSubmit: (response: Response, meta: { durationMs?: number; retry?: boolean; inputMode?: "voice" | "text"; recording?: Blob }) => Promise<void>;
  draft?: string;
  onDraft?: (text: string) => void;
  hideFeedback?: boolean;
}) {
  const L = useL();
  const { explanationLang, showPinyin } = usePrefs();
  const zh = languageId === "zh";
  const [choice, setChoice] = useState<number | null>(null);
  const [bool, setBool] = useState<boolean | null>(null);
  const [text, setText] = useState(draft ?? "");
  const [order, setOrder] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const answered = !!result && !retrying;
  const locked = !!result && !retrying;

  const ready = useMemo(() => {
    switch (ex.type) {
      case "mcq":
        return choice !== null;
      case "true_false":
        return bool !== null;
      case "sentence_order":
        return order.length === (ex.tokens?.length ?? 0);
      case "match_pairs":
        return Object.keys(pairs).length === (ex.left?.length ?? 0);
      default:
        return text.trim().length > 0;
    }
  }, [ex, choice, bool, order, pairs, text]);

  async function send(response: Response, meta: VoiceMeta | Record<string, never> = {}) {
    setBusy(true);
    try {
      await onSubmit(response, { ...meta, retry: retrying || undefined });
      if (retrying) setHasRetried(true);
      setRetrying(false);
    } finally {
      setBusy(false);
    }
  }

  function submitObjective() {
    switch (ex.type) {
      case "mcq":
        return send({ choice: choice! });
      case "true_false":
        return send({ bool: bool! });
      case "sentence_order":
        return send({ order: order.map((i) => ex.tokens![i]!) });
      case "match_pairs":
        return send({ pairs });
      default:
        return send({ text });
    }
  }

  const prompt = (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{L(...INSTRUCTIONS[ex.type])}</p>
      {ex.promptPinyin && (zh ? showPinyin : true) && <p className="text-sm text-muted-foreground">{ex.promptPinyin}</p>}
      <p className={cn("text-lg leading-snug font-medium", zh && "zh text-xl")}>{ex.prompt}</p>
      {ex.promptTh && <p className="text-sm text-muted-foreground">{ex.promptTh}</p>}
    </div>
  );

  const explanation = result && (explanationLang === "en" && result.explanationEn ? result.explanationEn : result.explanationTh);
  const len = lengthOf(languageId, text);

  return (
    <div className="space-y-5">
      {material?.kind === "dialogue" && <AudioPlayer segments={material.speech} lang={ttsLang} label={material.title} />}
      {material?.kind === "passage" && <PassageView title={material.title} lines={material.lines} glossary={material.glossary} language={languageId} />}
      {(ex.type === "listen_type" || ex.type === "repeat_sentence") && ex.speech && <AudioPlayer segments={ex.speech} lang={ttsLang} compact label={L("ฟังประโยค", "Sentence audio")} />}

      {prompt}

      {ex.type === "repeat_sentence" && (
        <div className="rounded-xl border bg-card p-4">
          {zh && showPinyin && ex.pinyin && <p className="text-sm text-muted-foreground">{ex.pinyin}</p>}
          <p className={cn("text-lg", zh && "zh")}>{ex.text}</p>
        </div>
      )}

      {ex.type === "mcq" && (
        <div role="radiogroup" className="grid gap-2">
          {ex.options!.map((o, i) => {
            const isChosen = choice === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={locked}
                onClick={() => setChoice(i)}
                className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors", isChosen ? "border-primary bg-accent" : "hover:bg-secondary", zh && "zh", locked && "cursor-default")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", isChosen && "border-primary bg-primary text-primary-foreground")}>{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            );
          })}
        </div>
      )}

      {ex.type === "true_false" && (
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={bool === v} disabled={locked} onClick={() => setBool(v)} className={cn("rounded-xl border px-4 py-3 font-medium", bool === v ? "border-primary bg-accent" : "hover:bg-secondary")}>
              {v ? L("ถูก · True", "True") : L("ผิด · False", "False")}
            </button>
          ))}
        </div>
      )}

      {(ex.type === "fill_blank" || ex.type === "word_recall" || ex.type === "listen_type") && (
        <Input
          value={text}
          onChange={(e) => (setText(e.target.value), onDraft?.(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && ready && !locked && submitObjective()}
          disabled={locked}
          className={cn(zh && "zh text-lg")}
          placeholder={L("พิมพ์คำตอบ", "Type your answer")}
          aria-label={L("คำตอบ", "Answer")}
          autoComplete="off"
          autoCapitalize="off"
        />
      )}

      {ex.type === "sentence_correction" && (
        <Textarea value={text} onChange={(e) => (setText(e.target.value), onDraft?.(e.target.value))} disabled={locked} className={cn("min-h-20", zh && "zh text-lg")} placeholder={L("พิมพ์ประโยคที่ถูกต้อง", "Type the corrected sentence")} aria-label={L("คำตอบ", "Answer")} />
      )}

      {ex.type === "sentence_order" && (
        <div className="space-y-3">
          <div className={cn("flex min-h-14 flex-wrap gap-2 rounded-xl border border-dashed p-3", zh && "zh")} aria-label={L("ประโยคของคุณ", "Your sentence")}>
            {order.length === 0 && <span className="text-sm text-muted-foreground">{L("แตะคำด้านล่าง", "Tap the words below")}</span>}
            {order.map((ti, pos) => (
              <button key={pos} type="button" disabled={locked} onClick={() => setOrder(order.filter((_, p) => p !== pos))} className="rounded-lg border bg-accent px-3 py-1.5 text-[15px]">
                {ex.tokens![ti]}
              </button>
            ))}
          </div>
          <div data-testid="token-bank" className={cn("flex flex-wrap gap-2", zh && "zh")}>
            {ex.tokens!.map((t, i) => (
              <button key={i} type="button" disabled={locked || order.includes(i)} onClick={() => setOrder([...order, i])} className="rounded-lg border bg-card px-3 py-1.5 text-[15px] disabled:opacity-30">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {ex.type === "match_pairs" && (
        <div className="space-y-2">
          {ex.left!.map((l) => (
            <div key={l} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
              <span className={cn("rounded-xl bg-secondary px-3 py-2.5 text-[15px] font-medium", zh && "zh")}>{l}</span>
              <select
                aria-label={l}
                value={pairs[l] ?? ""}
                disabled={locked}
                onChange={(e) => setPairs({ ...pairs, [l]: e.target.value })}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">{L("— เลือก —", "— choose —")}</option>
                {ex.right!.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {ex.type === "open_writing" && (!result || retrying) && (
        <div className="space-y-2">
          {ex.requirements && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {ex.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <Textarea value={text} onChange={(e) => (setText(e.target.value), onDraft?.(e.target.value))} className={cn("min-h-44", zh && "zh text-lg")} placeholder={retrying ? result?.evaluation?.retryPrompt : L("เขียนคำตอบที่นี่…", "Write here…")} aria-label={L("คำตอบ", "Answer")} />
          <p className={cn("text-xs", len >= (ex.minLength ?? 0) ? "text-emerald-700" : "text-muted-foreground")}>
            {len} / {ex.minLength}–{ex.maxLength} {zh ? L("ตัวอักษร", "characters") : L("คำ", "words")}
          </p>
        </div>
      )}

      {(ex.type === "speaking_response" || ex.type === "repeat_sentence") && (!result || retrying) && (
        <>
          {ex.requirements && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {ex.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <VoiceAnswer
            key={retrying ? "retry" : "first"}
            sttLang={sttLang}
            languageId={languageId}
            busy={busy}
            lockTranscript={ex.type === "repeat_sentence"}
            initialText={retrying ? "" : draft}
            onDraft={onDraft}
            onSubmit={(t, meta) => send({ transcript: t, durationMs: meta.durationMs, inputMode: meta.inputMode }, meta)}
          />
        </>
      )}

      {!["speaking_response", "repeat_sentence"].includes(ex.type) && (!result || retrying) && (
        <div className="flex justify-end">
          <Button onClick={submitObjective} disabled={!ready || busy || (ex.type === "open_writing" && len === 0)}>
            {busy && <Loader2 className="animate-spin" />} {retrying ? L("ส่งอีกครั้ง", "Submit again") : L("ส่งคำตอบ", "Submit")}
          </Button>
        </div>
      )}

      {answered && hideFeedback && <p className="rounded-xl bg-secondary px-4 py-3 text-sm">{L("บันทึกคำตอบแล้ว", "Answer saved")}</p>}

      {answered && !hideFeedback && result && (
        <div className="space-y-3 rounded-2xl border bg-card p-4" aria-live="polite">
          {!result.evaluation && (
            <p className={cn("flex items-center gap-2 font-semibold", result.correct ? "text-emerald-700" : "text-red-700")}>
              {result.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
              {result.correct ? L("ถูกต้อง", "Correct") : L("ยังไม่ถูก", "Not quite")}
              {result.score > 0 && result.score < 1 && <span className="text-sm font-normal">({Math.round(result.score * 100)}%)</span>}
            </p>
          )}
          {!result.correct && result.expected && !result.evaluation && (
            <p className={cn("text-sm", zh && "zh")}>
              <span className="text-muted-foreground">{L("คำตอบที่ถูก: ", "Answer: ")}</span>
              <span className="font-medium">{result.expected}</span>
            </p>
          )}
          {result.diff && <DiffView tokens={result.diff} zh={zh} />}
          {result.diff && ex.type === "repeat_sentence" && <p className="text-xs text-muted-foreground">{L("เทียบจากคำที่ระบบรู้จำได้ ไม่ใช่คะแนนการออกเสียงระดับหน่วยเสียง", "Compared by recognised words — not a phoneme-level pronunciation score.")}</p>}
          {result.evaluation && <EvaluationView ev={result.evaluation} retried={hasRetried} onRetry={() => (setRetrying(true), setText(""))} />}
          {explanation && !result.evaluation && <p className="text-sm text-muted-foreground">{explanation}</p>}
          {result.transcript && <TranscriptView lines={result.transcript} language={languageId} />}
          {result.modelAnswer && (
            <details className="rounded-xl border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{L("ตัวอย่างคำตอบ", "Model answer")}</summary>
              <p className={cn("mt-2 whitespace-pre-wrap", zh && "zh")}>{result.modelAnswer}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
