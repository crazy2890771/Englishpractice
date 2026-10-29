"use client";
import { useMemo, useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { GlossaryEntry, Line } from "@/content/types";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Piece = { text: string; entry?: GlossaryEntry };

/** Splits text into plain pieces and glossary words (longest match first; works for Hanzi and Latin). */
export function segmentText(text: string, glossary: GlossaryEntry[]): Piece[] {
  const words = [...glossary].sort((a, b) => b.word.length - a.word.length);
  const out: Piece[] = [];
  let buf = "";
  let i = 0;
  const latin = (c: string | undefined) => !!c && /[A-Za-z0-9'-]/.test(c);
  outer: while (i < text.length) {
    for (const g of words) {
      const w = g.word;
      if (text.slice(i, i + w.length).toLowerCase() === w.toLowerCase() && !(latin(w[0]) && (latin(text[i - 1]) || latin(text[i + w.length])))) {
        if (buf) out.push({ text: buf });
        buf = "";
        out.push({ text: text.slice(i, i + w.length), entry: g });
        i += w.length;
        continue outer;
      }
    }
    buf += text[i];
    i++;
  }
  if (buf) out.push({ text: buf });
  return out;
}

function Word({ piece, language }: { piece: Piece; language: string }) {
  const L = useL();
  const [saved, setSaved] = useState(false);
  const g = piece.entry!;
  return (
    <Popover>
      <PopoverTrigger className="rounded-sm underline decoration-primary/40 decoration-dotted underline-offset-4 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {piece.text}
      </PopoverTrigger>
      <PopoverContent className="space-y-2 text-sm">
        <p className={cn("text-base font-semibold", language === "zh" && "zh")}>
          {g.word} {g.pronunciation && <span className="ml-1 text-sm font-normal text-muted-foreground">{g.pronunciation}</span>}
        </p>
        <p>{g.meaningTh}</p>
        {g.meaningEn && <p className="text-muted-foreground">{g.meaningEn}</p>}
        {g.example && <p className={cn("text-muted-foreground italic", language === "zh" && "zh not-italic")}>“{g.example}”</p>}
        <Button
          size="sm"
          variant="outline"
          disabled={saved}
          onClick={async () => {
            await api("/api/vocab/add", { body: { language, word: g.word, meaningTh: g.meaningTh, meaningEn: g.meaningEn ?? "", pronunciation: g.pronunciation ?? null, example: g.example ?? "" } }).catch(() => {});
            setSaved(true);
          }}
        >
          {saved ? <Check /> : <BookmarkPlus />} {saved ? L("บันทึกแล้ว", "Saved") : L("บันทึกคำศัพท์", "Save word")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function PassageView({ title, lines, glossary, language }: { title: string; lines: Line[]; glossary: GlossaryEntry[]; language: string }) {
  const L = useL();
  const prefs = usePrefs();
  const [pinyin, setPinyin] = useState(prefs.showPinyin);
  const [translate, setTranslate] = useState(false);
  const segmented = useMemo(() => lines.map((l) => segmentText(l.text, glossary)), [lines, glossary]);
  const zh = language === "zh";
  return (
    <article className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className={cn("font-semibold", zh && "zh")}>{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          {zh && (
            <span className="flex items-center gap-2">
              <Switch id="py" checked={pinyin} onCheckedChange={setPinyin} />
              <Label htmlFor="py" className="text-xs">
                {L("พินอิน", "Pinyin")}
              </Label>
            </span>
          )}
          {lines.some((l) => l.th) && (
            <span className="flex items-center gap-2">
              <Switch id="tr" checked={translate} onCheckedChange={setTranslate} />
              <Label htmlFor="tr" className="text-xs">
                {L("คำแปล", "Translation")}
              </Label>
            </span>
          )}
        </div>
      </div>
      <div className={cn("space-y-3 text-[15px] leading-relaxed", zh && "zh text-[17px] leading-loose")}>
        {lines.map((l, i) => (
          <div key={i}>
            {zh && pinyin && l.pinyin && <p className="text-sm text-muted-foreground">{l.pinyin}</p>}
            <p>
              {l.speaker && <span className="font-medium">{l.speaker}: </span>}
              {segmented[i]!.map((p, j) => (p.entry ? <Word key={j} piece={p} language={language} /> : <span key={j}>{p.text}</span>))}
            </p>
            {translate && l.th && <p className="mt-0.5 text-sm text-muted-foreground">{l.th}</p>}
          </div>
        ))}
      </div>
      {glossary.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{L("แตะคำที่ขีดเส้นใต้เพื่อดูความหมาย", "Tap underlined words for meaning.")}</p>}
    </article>
  );
}

/** Transcript shown after answering a listening item. */
export function TranscriptView({ lines, language }: { lines: Line[]; language: string }) {
  const { showPinyin } = usePrefs();
  const L = useL();
  const zh = language === "zh";
  return (
    <details className="rounded-xl border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-medium">{L("ดูบทถอดเสียง", "Show transcript")}</summary>
      <div className={cn("mt-2 space-y-1.5", zh && "zh")}>
        {lines.map((l, i) => (
          <div key={i}>
            {zh && showPinyin && l.pinyin && <p className="text-xs text-muted-foreground">{l.pinyin}</p>}
            <p>
              {l.speaker && <span className="font-medium">{l.speaker}: </span>}
              {l.text}
            </p>
            {l.th && <p className="text-xs text-muted-foreground">{l.th}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}
