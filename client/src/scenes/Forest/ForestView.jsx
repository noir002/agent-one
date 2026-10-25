import { lazy, Suspense, useEffect, useState } from "react";
import { use3DSupport } from "./use3DSupport.js";
import SVGForestFallback from "./SVGForestFallback.jsx";

// Lazy-loaded so the 3D scene's bundle (three.js + r3f + drei) never blocks
// first paint — it's requested only after the shell has rendered.
const Forest = lazy(() => import("./Forest.jsx"));

function ForestPlaceholder() {
  return (
    <div className="flex h-[520px] w-full items-center justify-center text-sm text-ink-muted">
      Growing the forest…
    </div>
  );
}

export default function ForestView({ groves, query }) {
  const supports3D = use3DSupport();
  const [readyFor3D, setReadyFor3D] = useState(false);

  useEffect(() => {
    if (!supports3D) return;
    const id = requestIdleCallback ? requestIdleCallback(() => setReadyFor3D(true)) : setTimeout(() => setReadyFor3D(true), 0);
    return () => (requestIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, [supports3D]);

  if (!supports3D || groves.every((g) => g.listings.length === 0)) {
    return <SVGForestFallback groves={groves} query={query} />;
  }

  if (!readyFor3D) return <ForestPlaceholder />;

  return (
    <Suspense fallback={<ForestPlaceholder />}>
      <Forest groves={groves} query={query} />
    </Suspense>
  );
}
