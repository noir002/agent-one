import { useEffect, useState } from "react";

// Decides between the real 3D forest and the 2D SVG fallback: phones,
// low-power devices and prefers-reduced-motion all get the 2D version.
// hardwareConcurrency is a rough, documented proxy for "low-power" — there's
// no reliable GPU-capability signal available from the browser without WebGL
// probing, which is overkill for a Phase 1 fallback decision.
export function use3DSupport() {
  const [supports3D, setSupports3D] = useState(true);

  useEffect(() => {
    const isNarrow = window.matchMedia("(max-width: 768px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator.hardwareConcurrency || 8) < 4;
    setSupports3D(!isNarrow && !reducedMotion && !lowPower);
  }, []);

  return supports3D;
}
