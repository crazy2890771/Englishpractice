"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flashcard, type VocabCardData } from "@/components/learn/flashcard";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText } from "@/i18n";

export function ReviewClient({ items }: { items: (VocabCardData & { languageId: string })[] }) {
  const L = useL();
  const { uiLang } = usePrefs();
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const card = items[i];

  async function rate(q: number) {
    if (!card) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ correct: boolean }>("/api/vocab/review", { body: { itemId: card.id, quality: q } });
      if (r.correct) setCorrect((c) => c + 1);
      setI((x) => x + 1);
    } catch (e) {
      setErr(errorText((e as ApiError).code, uiLang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{L("ทบทวนคำศัพท์", "Vocabulary review")}</h1>
        <p className="text-sm text-muted-foreground">{L("คำที่จำได้จะกลับมาให้ทบทวนห่างขึ้น คำที่ลืมจะกลับมาเร็วขึ้น", "Words you know come back less often; forgotten words come back sooner.")}</p>
      </header>
      {card ? (
        <>
          <div className="flex items-center gap-3">
            <Progress value={(i / items.length) * 100} aria-label={L("ความคืบหน้า", "Progress")} />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {i + 1}/{items.length}
            </span>
          </div>
          <Flashcard key={card.id} card={card} languageId={card.languageId} ttsLang={card.languageId === "zh" ? "zh-CN" : "en-US"} onRate={rate} disabled={busy} />
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        </>
      ) : (
        <div className="space-y-4 rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="font-medium">{items.length ? L(`ทบทวนครบแล้ว · จำได้ ${correct}/${items.length}`, `All done · remembered ${correct}/${items.length}`) : L("ยังไม่มีคำที่ถึงกำหนดทบทวน", "No words are due right now.")}</p>
          <p className="text-sm text-muted-foreground">{L("คำศัพท์จากบทเรียนจะเข้ามาในคลังอัตโนมัติ", "Words from your lessons are added automatically.")}</p>
          <Button asChild variant="outline">
            <Link href="/today">{L("กลับหน้าวันนี้", "Back to Today")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
