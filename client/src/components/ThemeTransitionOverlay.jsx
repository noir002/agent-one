import { useTheme } from "../lib/ThemeContext.jsx";

// The "popup growing from the middle of the screen" step of the slide-to-
// dark flow (see ThemeContext.jsx's enterDark): a circle expands from the
// viewport's center until it fully covers it — the route change happens
// while hidden behind it — then it shrinks back away to reveal the new
// (dark) page. Fixed/viewport-based rather than page-relative, since it's
// meant to read as the whole site transitioning, not just one section of
// one page. Uses an explicit dark color rather than the bg-ink token —
// by the time this plays the theme has already flipped to dark, so bg-ink
// would resolve to dark theme's *light* ink value, the opposite of what a
// "the dark theme is arriving" moment should look like.
export default function ThemeTransitionOverlay() {
  const { transitionPhase } = useTheme();
  const growing = transitionPhase === "growing";

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="rounded-full transition-all duration-500 ease-[cubic-bezier(0.6,0,0.4,1)]"
        style={{
          width: growing ? "300vmax" : "4rem",
          height: growing ? "300vmax" : "4rem",
          opacity: growing ? 1 : 0,
          background: "rgb(3 3 4)",
        }}
      />
    </div>
  );
}
