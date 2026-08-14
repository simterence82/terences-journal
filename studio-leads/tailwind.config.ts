import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        ink: "var(--ink)",
        surface: "var(--surface)",
        "surface-ink": "var(--surface-ink)",
        panel: "var(--panel)",
        "panel-ink": "var(--panel-ink)",
        pop: "var(--pop)",
        "pop-ink": "var(--pop-ink)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        faint: "var(--faint)",
        "faint-ink": "var(--faint-ink)",
        ok: "var(--ok)",
        "ok-ink": "var(--ok-ink)",
        bad: "var(--bad)",
        "bad-ink": "var(--bad-ink)",
        warn: "var(--warn)",
        "warn-ink": "var(--warn-ink)",
        line: "var(--line)",
      },
      fontFamily: {
        display: "var(--font-display)",
        base: "var(--font-base)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
        DEFAULT: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
        md: "0 8px 20px rgba(15, 23, 42, 0.10)",
        lg: "0 20px 40px rgba(15, 23, 42, 0.14)",
        ring: "0 0 0 3px var(--ring)",
      },
    },
  },
  plugins: [],
} satisfies Config;
