"use client";
import { useEffect } from "react";
import { LogoMark } from "@/components/app/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด</h1>
      <p className="text-sm text-muted-foreground">Something went wrong. ความคืบหน้าที่บันทึกแล้วไม่หาย ลองใหม่อีกครั้ง</p>
      <button onClick={reset} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">ลองใหม่ · Try again</button>
    </main>
  );
}
