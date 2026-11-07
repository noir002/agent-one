import { createContext, useContext, useEffect, useMemo, useState } from "react";

// App-wide light/dark toggle, driven by the single ThemeToggleSlider
// control (rendered in both the Home hero and NavPill, so "Submit your own
// agent" and "Find listings" are the same component in two states, not two
// different ones). Deliberately not persisted (no localStorage) — this is a
// deliberate mode switch tied to that one control, not a general site
// preference, so it resets to light on reload.
const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  transitionPhase: "idle",
  enterDark: () => {},
  exitDark: () => {},
});

// Timings for the forward (light -> dark) transition: the slider completes
// and the theme flips immediately (the current page repaints dark, e.g.
// Home's hero swapping to the night photo) — then a pause so that's
// actually visible — then a circle grows from the center of the viewport
// until it fully covers it, the route changes underneath while hidden,
// and the circle shrinks back away to reveal the new (dark) page.
const REVEAL_PAUSE_MS = 2500;
const GROW_MS = 550;
const HOLD_MS = 200;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [transitionPhase, setTransitionPhase] = useState("idle"); // idle | growing

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Called once the slider has been dragged/tapped to completion while in
  // light mode. `navigate` is passed in by the caller (useNavigate can only
  // be called from inside a component, not this provider).
  const enterDark = (navigate) => {
    setTheme("dark");
    setTimeout(() => {
      setTransitionPhase("growing");
      setTimeout(() => {
        navigate("/test-agent");
        setTimeout(() => setTransitionPhase("idle"), HOLD_MS);
      }, GROW_MS);
    }, REVEAL_PAUSE_MS);
  };

  // The reverse direction is the simple, immediate case — no reveal pause
  // or popup, just back to light and home.
  const exitDark = (navigate) => {
    setTheme("light");
    navigate("/");
  };

  const value = useMemo(() => ({ theme, setTheme, transitionPhase, enterDark, exitDark }), [theme, transitionPhase]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
