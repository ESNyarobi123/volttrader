import type { Config } from "tailwindcss";

/**
 * Volt Trades design system — crimson + off-white + near-black.
 * Brand CTAs use crimson (#c41e3a); gold/green are secondary accents only.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        volt: {
          DEFAULT: "hsl(var(--volt))",
          foreground: "hsl(var(--volt-foreground))",
          dim: "hsl(var(--volt-dim))",
          hover: "hsl(var(--volt-hover))",
          light: "hsl(var(--volt-light))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          deep: "hsl(var(--ink-deep))",
        },
        "accent-blue": "hsl(var(--accent-blue))",
        "accent-purple": "hsl(var(--accent-purple))",
        "accent-gold": "hsl(var(--accent-gold))",
        "accent-mint": "hsl(var(--accent-mint))",
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
      },
      borderRadius: {
        lg: "0.7rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        volt: "0 10px 30px -10px hsl(var(--volt) / 0.4)",
        card: "0 1px 2px 0 hsl(0 0% 10% / 0.04), 0 12px 28px -16px hsl(0 0% 10% / 0.12)",
        lift: "0 20px 48px -24px hsl(0 0% 10% / 0.22)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
