/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#05080A", raised: "#0B1114" },
        ink: { DEFAULT: "#E8F1EE", muted: "#8FA39B" },
        glow: { green: "#064E3B", purple: "#4C1D95" },
        emerald: { DEFAULT: "#34D399" },
        violet: { DEFAULT: "#A78BFA" },
        teal: { DEFAULT: "#0D9488" },
        amber: { DEFAULT: "#FBBF24" },
        tier: {
          l0: "#8FA39B",
          l1: "#34D399",
          l2: "#A78BFA",
          l3: "#F0EBFF",
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
