export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="none" stroke="url(#lg-logo)" strokeWidth="3.5" strokeDasharray="100 26" strokeLinecap="round" transform="rotate(130 24 24)" />
      <path d="M15 31V22M21 31V17M27 31V20M33 31V14" stroke="url(#lg-logo)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-sm font-bold leading-tight">
        English
        <br />
        Fluency Lab
      </span>
    </span>
  );
}
