import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-foreground": "var(--surface-foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popup: "var(--popup)",
        "popup-foreground": "var(--popup-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        success: "var(--success)",
        "success-foreground": "var(--success-foreground)",
        error: "var(--error)",
        "error-foreground": "var(--error-foreground)",
        warning: "var(--warning)",
        "warning-foreground": "var(--warning-foreground)",
        border: "var(--border)",
      },
      fontFamily: {
        display: "var(--font-family-display)",
        base: "var(--font-family-base)",
        mono: "var(--font-family-monospace)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        focus: "var(--shadow-focus)",
      },
    },
  },
  plugins: [],
} satisfies Config;
