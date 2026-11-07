/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Every token resolves from a CSS variable (defined in index.css as
        // space-separated RGB, light values on :root, dark values under
        // [data-theme="dark"]) instead of a static hex — that's what lets
        // the whole app's existing text-ink/bg-bg/etc classes respond to
        // the runtime theme toggle without touching every component.
        bg: { DEFAULT: "rgb(var(--color-bg) / <alpha-value>)", raised: "rgb(var(--color-bg-raised) / <alpha-value>)" },
        ink: { DEFAULT: "rgb(var(--color-ink) / <alpha-value>)", muted: "rgb(var(--color-ink-muted) / <alpha-value>)" },
        glow: { green: "#064E3B", purple: "#4C1D95" },
        emerald: { DEFAULT: "rgb(var(--color-emerald) / <alpha-value>)" },
        violet: { DEFAULT: "rgb(var(--color-violet) / <alpha-value>)" },
        teal: { DEFAULT: "rgb(var(--color-teal) / <alpha-value>)" },
        amber: { DEFAULT: "rgb(var(--color-amber) / <alpha-value>)" },
        tier: {
          l0: "rgb(var(--color-tier-l0) / <alpha-value>)",
          l1: "rgb(var(--color-tier-l1) / <alpha-value>)",
          l2: "rgb(var(--color-tier-l2) / <alpha-value>)",
          l3: "rgb(var(--color-tier-l3) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        devanagari: ["Tiro Devanagari Hindi", "Noto Serif Devanagari", "serif"],
        sans: ["Inter Tight", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "20px",
      },
      backdropBlur: {
        glass: "24px",
      },
    },
  },
  plugins: [],
};
