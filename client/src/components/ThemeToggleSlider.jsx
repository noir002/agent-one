import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext.jsx";

// One slider, two states — not a separate "Submit your own agent" button in
// the hero and a separate "Find listings" button in the nav. In light
// theme the thumb rests at the left reading "Submit your own agent"; drag
// (or tap) it to the right to flip the whole app dark and head into the
// sandbox-testing flow. While dark the SAME control rests at the right
// reading "Find listings" on the revealed left side — drag/tap it back to
// flip to light and return home. Track/thumb colors are plain bg-ink /
// bg-bg-raised / text-ink / text-bg — since those tokens already invert
// between themes (see index.css), the thumb and arrow genuinely swap from
// black-on-white to white-on-black for free, no conditional color classes
// needed.
//
// Drag tracking is window-level (not just the thumb's own pointer capture)
// and reads/writes refs rather than React state inside the move/up
// handlers — both deliberate: capture alone can be lost on a fast flick,
// and closing over `dragging` as state risks a stale-closure race where a
// pointermove fires before React has committed the pointerdown's state
// update, silently dropping the drag. The track width is also re-measured
// on every pointerdown instead of once on mount — the nav's copy of this
// component sits behind a `hidden sm:flex` class, so a mount-time
// measurement can read 0 if it happens while hidden and never self-correct.
const THUMB_SIZE = 44;
const TRACK_PADDING = 4;
const COMPLETE_THRESHOLD = 0.7;
const DRAG_DEADZONE = 4;

export default function ThemeToggleSlider({ className = "", compact = false }) {
  const navigate = useNavigate();
  const { theme, enterDark, exitDark } = useTheme();
  const reversed = theme === "dark";

  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  const startXRef = useRef(0);
  const maxDragRef = useRef(0);
  const dragXRef = useRef(0);
  const cleanupRef = useRef(() => {});

  const [dragX, setDragXState] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const setDragX = (x) => {
    dragXRef.current = x;
    setDragXState(x);
  };

  const restX = () => (reversed ? maxDragRef.current : 0);

  // Keeps the thumb parked at the correct end whenever the theme changes
  // out from under this instance (e.g. the hero's copy reacting to the nav
  // copy's slide completing, or vice versa) — never while this instance
  // itself is mid-drag.
  useEffect(() => {
    if (draggingRef.current) return;
    if (trackRef.current) maxDragRef.current = trackRef.current.offsetWidth - THUMB_SIZE - TRACK_PADDING * 2;
    setTransitioning(true);
    setDragX(restX());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reversed]);

  const complete = () => {
    setTransitioning(true);
    setDragX(reversed ? 0 : maxDragRef.current);
    if (reversed) exitDark(navigate);
    else enterDark(navigate);
  };

  const snapBack = () => {
    setTransitioning(true);
    setDragX(restX());
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    cleanupRef.current();

    if (!draggedRef.current) return; // a plain tap/click — the native click handles it
    const traveled = reversed ? maxDragRef.current - dragXRef.current : dragXRef.current;
    const progress = maxDragRef.current > 0 ? traveled / maxDragRef.current : 0;
    if (progress >= COMPLETE_THRESHOLD) complete();
    else snapBack();
  };

  const onPointerDown = (e) => {
    if (trackRef.current) maxDragRef.current = trackRef.current.offsetWidth - THUMB_SIZE - TRACK_PADDING * 2;
    draggedRef.current = false;
    draggingRef.current = true;
    setTransitioning(false);
    startXRef.current = e.clientX - dragXRef.current;

    const onMove = (ev) => {
      const raw = ev.clientX - startXRef.current;
      const clamped = Math.min(Math.max(raw, 0), maxDragRef.current);
      if (Math.abs(clamped - restX()) > DRAG_DEADZONE) draggedRef.current = true;
      setDragX(clamped);
    };
    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  };

  const onClick = () => {
    // Fires on a plain tap (no real drag) and on keyboard activation, which
    // never generates pointer events at all. A real drag is resolved by
    // endDrag() above and must not also be completed here.
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    complete();
  };

  useEffect(() => () => cleanupRef.current(), []);

  const traveled = reversed ? maxDragRef.current - dragX : dragX;
  const progress = maxDragRef.current > 0 ? traveled / maxDragRef.current : 0;
  const height = compact ? 40 : 52;
  const thumbSize = compact ? 32 : THUMB_SIZE;

  return (
    <div
      ref={trackRef}
      className={`relative flex w-full max-w-xs select-none items-center rounded-full bg-ink p-1 ${className}`}
      style={{ height }}
    >
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-bg"
        style={{ opacity: Math.max(0, 1 - progress * 1.6) }}
      >
        {reversed ? "Find listings" : "Submit your own agent"}
      </span>
      <button
        type="button"
        aria-label={reversed ? "Slide to find listings — back to the light theme" : "Slide to submit your own agent — opens the sandbox test page"}
        onPointerDown={onPointerDown}
        onClick={onClick}
        style={{
          width: thumbSize,
          height: thumbSize,
          transform: `translateX(${dragX}px)`,
          transition: transitioning ? "transform 0.3s cubic-bezier(0.22,1,0.36,1)" : "none",
        }}
        className="relative z-10 flex shrink-0 touch-none items-center justify-center rounded-2xl bg-bg-raised text-ink shadow-sm"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          {reversed ? (
            <>
              <path d="M14 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <>
              <path d="M2 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
