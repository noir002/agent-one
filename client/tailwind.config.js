/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Light theme (replaces the earlier dark/glass palette): a warm
        // off-white page with near-black ink, matching the reference
        // mockup's neutral-plus-photography look. "raised" is pure white
        // for cards sitting above the off-white page body.
        bg: { DEFAULT: "#F6F5F1", raised: "#FFFFFF" },
        ink: { DEFAULT: "#16181B", muted: "#6B7069" },
        glow: { green: "#064E3B", purple: "#4C1D95" },
        emerald: { DEFAULT: "#34D399" },
        violet: { DEFAULT: "#A78BFA" },
        teal: { DEFAULT: "#0D9488" },
        amber: { DEFAULT: "#FBBF24" },
        // Darkened from their original dark-mode values (which assumed a
        // near-black backdrop, e.g. tier-l3 was near-white to "pop" on
        // black) so each still reads as real text on a light page.
        tier: {
          l0: "#5B6B64",
          l1: "#34D399",
          l2: "#7C5CE0",
          l3: "#4C1D95",
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
