/** Decorative mountain-and-sky illustration used on hero banners (pure SVG, no image assets). */
export function MountainScene({ className, variant = "dusk" }: { className?: string; variant?: "dusk" | "night" }) {
  const sky = variant === "dusk" ? ["#1e1b4b", "#4c1d95", "#c2410c", "#fb923c"] : ["#020617", "#0f172a", "#1e1b4b", "#312e81"];
  return (
    <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="0.45" stopColor={sky[1]} />
          <stop offset="0.8" stopColor={sky[2]} />
          <stop offset="1" stopColor={sky[3]} />
        </linearGradient>
        <linearGradient id={`m1-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`m2-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill={`url(#sky-${variant})`} />
      {variant === "night" &&
        Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 197) % 800} cy={(i * 89) % 200} r={(i % 3) * 0.5 + 0.5} fill="#fff" opacity={0.35 + (i % 4) * 0.12} />)}
      <circle cx="560" cy="250" r="60" fill="#fde68a" opacity={variant === "dusk" ? 0.35 : 0.08} />
      <path d="M0 290 L90 200 L150 240 L250 140 L330 220 L420 160 L500 230 L600 130 L700 210 L800 170 L800 400 L0 400Z" fill={`url(#m1-${variant})`} opacity="0.85" />
      <path d="M250 140 L272 160 L262 162 L250 152 L238 165 L230 160Z M600 130 L624 152 L612 152 L600 142 L588 156 L580 150Z" fill="#e2e8f0" opacity="0.5" />
      <path d="M0 330 L120 260 L210 300 L310 230 L420 300 L520 250 L640 310 L740 260 L800 290 L800 400 L0 400Z" fill={`url(#m2-${variant})`} />
      <path d="M0 370 Q200 330 400 360 T800 350 L800 400 L0 400Z" fill="#020617" opacity="0.9" />
    </svg>
  );
}
