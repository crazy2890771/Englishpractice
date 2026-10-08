"use client";
import clsx from "clsx";
import { useState } from "react";
import { ConversationRoom } from "@/components/practice/conversation-room";
import { useStudyTime } from "@/lib/client/use-study-time";
import { useAppConfig } from "@/components/providers";
import { Notice } from "@/components/ui";

export function SpeakingRoom({ topics }: { topics: { id: string; label: string; first: string }[] }) {
  const [topic, setTopic] = useState<string | null>(null);
  const { settings } = useAppConfig();
  useStudyTime({ active: !!topic });
  const current = topics.find((t) => t.id === topic);
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Conversation topic" className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={topic === t.id}
            onClick={() => setTopic(t.id)}
            className={clsx("rounded-full border px-4 py-2 text-sm font-medium transition", topic === t.id ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-surface-2")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {settings.interruptionFree && <Notice>Interruption-free mode is on: feedback is shown when you end the conversation. Change it in Settings.</Notice>}
      {current ? (
        <ConversationRoom key={current.id} mode="SPEAKING" topicKey={`topic:${current.id}`} title={current.label} subtitle="Free conversation" />
      ) : (
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold">Choose a topic to start</p>
          <p className="mt-1 text-sm text-muted">The AI asks one question at a time and adapts follow-up questions to your answers. Speak or type.</p>
        </div>
      )}
    </div>
  );
}
