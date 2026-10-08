import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
        },
        accent: "rgb(var(--accent) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.4), 0 8px 30px -8px rgb(var(--brand) / 0.55)",
      },
      keyframes: {
        wave: { "0%,100%": { transform: "scaleY(0.35)" }, "50%": { transform: "scaleY(1)" } },
        pulseRing: { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.5)", opacity: "0" } },
        fadeIn: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        wave: "wave 1.1s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        "fade-in": "fadeIn .25s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
