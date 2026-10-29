"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Uploads a speaking recording to the learner's private folder and registers it. Best-effort. */
export async function saveRecording(userId: string, blob: Blob, info: { languageId: string; transcript?: string; exerciseId?: string; prompt?: string; durationMs?: number }) {
  try {
    const type = blob.type.split(";")[0] || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("recordings").upload(path, blob, { contentType: type, upsert: false });
    if (error) return false;
    const res = await fetch("/api/recordings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, mimeType: type, ...info }) });
    return res.ok;
  } catch {
    return false;
  }
}
