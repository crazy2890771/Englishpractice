export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="oklch(0.5 0.15 255)" />
      <path d="M12 27V13h10M12 20h8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M25 13v14h5" stroke="white" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">Fluency Lab</span>
        <span className="block text-[11px] text-muted-foreground">Personal Language Academy</span>
      </span>
    </span>
  );
}
