"use client";
import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useL, usePrefs } from "@/components/app/ui-context";
import { speakSegments, unlockAudio } from "@/lib/client/speech";

export interface VocabCardData {
  id: string;
  word: string;
  pronunciation: string | null;
  meaningTh: string;
  meaningEn: string;
  example: string;
  exampleTranslation: string;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/** Spaced-repetition flashcard: recall → reveal → self-rate (Again / Hard / Good / Easy). */
export function Flashcard({ card, languageId, ttsLang, onRate, disabled }: { card: VocabCardData; languageId: string; ttsLang: string; onRate: (quality: number) => void; disabled?: boolean }) {
  const L = useL();
  const { showPinyin, ttsServer, playbackSpeed } = usePrefs();
  const [revealed, setRevealed] = useState(false);
  const zh = languageId === "zh";
  const say = () => {
    unlockAudio();
    void speakSegments([{ voice: "female", t: b64(card.word) }], { lang: ttsLang, rate: playbackSpeed, server: ttsServer }).catch(() => {});
  };
  const ratings = [
    { q: 1, th: "ลืม", en: "Again", cls: "border-red-200 text-red-700" },
    { q: 3, th: "ยาก", en: "Hard", cls: "border-amber-200 text-amber-800" },
    { q: 4, th: "จำได้", en: "Good", cls: "border-sky-200 text-sky-800" },
    { q: 5, th: "ง่าย", en: "Easy", cls: "border-emerald-200 text-emerald-700" },
  ];
  return (
    <div className="space-y-5 text-center">
      <div className="rounded-2xl border bg-card px-6 py-10">
        <p className={cn("text-3xl font-semibold", zh && "zh text-4xl")}>{card.word}</p>
        {zh && showPinyin && card.pronunciation && <p className="mt-2 text-muted-foreground">{card.pronunciation}</p>}
        <Button variant="ghost" size="sm" className="mt-2" onClick={say} aria-label={L("ฟังเสียง", "Listen")}>
          <Volume2 /> {L("ฟัง", "Listen")}
        </Button>
        {revealed && (
          <div className="mt-5 space-y-2 border-t pt-5 text-left text-sm">
            {!zh && card.pronunciation && <p className="text-muted-foreground">{card.pronunciation}</p>}
            <p className="text-base font-medium">{card.meaningTh}</p>
            {card.meaningEn && <p className="text-muted-foreground">{card.meaningEn}</p>}
            {card.example && <p className={cn("pt-2", zh && "zh")}>“{card.example}”</p>}
            {card.exampleTranslation && <p className="text-muted-foreground">{card.exampleTranslation}</p>}
          </div>
        )}
      </div>
      {!revealed ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{L("นึกความหมายในใจ แล้วกดดูคำตอบ", "Recall the meaning, then reveal.")}</p>
          <Button size="lg" onClick={() => setRevealed(true)} autoFocus>
            {L("ดูคำตอบ", "Reveal")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2" role="group" aria-label={L("คุณจำได้แค่ไหน", "How well did you remember?")}>
          {ratings.map((r) => (
            <Button key={r.q} variant="outline" className={cn("h-12", r.cls)} disabled={disabled} onClick={() => onRate(r.q)}>
              {L(r.th, r.en)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
