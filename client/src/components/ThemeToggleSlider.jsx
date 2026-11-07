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
const THUMB_SIZE = 44;
const TRACK_PADDING = 4;
const COMPLETE_THRESHOLD = 0.7;

export default function ThemeToggleSlider({ className = "", compact = false }) {
  const navigate = useNavigate();
  const { theme, enterDark, exitDark } = useTheme();
  const reversed = theme === "dark";

  const trackRef = useRef(null);
  const draggedRef = useRef(false);
  const startXRef = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [maxDrag, setMaxDrag] = useState(0);

  useEffect(() => {
    if (trackRef.current) setMaxDrag(trackRef.current.offsetWidth - THUMB_SIZE - TRACK_PADDING * 2);
  }, []);

  // Keeps the thumb parked at the correct end for the current theme —
  // matters most for whichever instance of this component wasn't the one
  // that just completed a drag (e.g. the hero's copy, if still mounted,
  // reacting to the nav copy's slide, or vice versa).
  useEffect(() => {
    if (!dragging && maxDrag > 0) setDragX(reversed ? maxDrag : 0);
  }, [reversed, maxDrag, dragging]);

  const complete = () => {
    setDragX(reversed ? 0 : maxDrag);
    if (reversed) exitDark(navigate);
    else enterDark(navigate);
  };

  const snapBack = () => setDragX(reversed ? maxDrag : 0);

  const onPointerDown = (e) => {
    draggedRef.current = false;
    startXRef.current = e.clientX - dragX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    draggedRef.current = true;
    const raw = e.clientX - startXRef.current;
    setDragX(Math.min(Math.max(raw, 0), maxDrag));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (!draggedRef.current) return; // a plain tap — let the native click handle it
    const traveled = reversed ? maxDrag - dragX : dragX;
    const progress = maxDrag > 0 ? traveled / maxDrag : 0;
    if (progress >= COMPLETE_THRESHOLD) complete();
    else snapBack();
  };

  const onClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    complete();
  };

  const traveled = reversed ? maxDrag - dragX : dragX;
  const progress = maxDrag > 0 ? traveled / maxDrag : 0;
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
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        style={{
          width: thumbSize,
          height: thumbSize,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
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
