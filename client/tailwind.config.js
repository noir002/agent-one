/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#141816", muted: "#59625E" },
        panel: "#F4F5F4",
        emerald: { DEFAULT: "#0F6B4B", light: "#5AA37F" },
        border: { card: "#EDF0EE", pill: "#DFE3E0" },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "serif"],
        sans: ["Geist Sans", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
