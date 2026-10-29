import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/app/logo";

export const metadata = { title: "ออฟไลน์" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-12" />
      <WifiOff className="size-6 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
      <p className="text-sm text-muted-foreground">Fluency Lab ต้องใช้อินเทอร์เน็ตเพื่อบันทึกความคืบหน้าและตรวจคำตอบ เชื่อมต่อแล้วลองใหม่อีกครั้ง — คำตอบที่ส่งแล้วถูกบันทึกไว้ และบทเรียนจะเริ่มต่อจากจุดเดิม</p>
      <p className="text-xs text-muted-foreground">You&apos;re offline. Reconnect to continue — your lesson resumes where you left off.</p>
      <a href="/today" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">ลองใหม่ · Retry</a>
    </main>
  );
}
