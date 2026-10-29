import Link from "next/link";
import { LogoMark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="text-xl font-semibold">ไม่พบหน้านี้</h1>
      <p className="text-sm text-muted-foreground">Page not found.</p>
      <Link href="/today" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">กลับหน้าวันนี้ · Back to Today</Link>
    </main>
  );
}
