// Pure layout math: turns {category, listings[]} groups into 3D positions
// for trunks, branches and nodes. Kept separate from the R3F components so
// it's easy to reason about and test without a renderer.

const GROVE_RADIUS = 7;
const TRUNK_HEIGHT = 4.2;

export function buildForestLayout(groves) {
  const groveCount = groves.length || 1;
  return groves.map((grove, groveIndex) => {
    const angle = (groveIndex / groveCount) * Math.PI * 2;
    const trunkBase = [Math.cos(angle) * GROVE_RADIUS, 0, Math.sin(angle) * GROVE_RADIUS];
    const trunkTop = [trunkBase[0], TRUNK_HEIGHT, trunkBase[2]];
    const outward = [Math.cos(angle), 0, Math.sin(angle)];

    const nodes = grove.listings.map((listing, i) => {
      const n = grove.listings.length;
      const heightFrac = 0.35 + (i / Math.max(n - 1, 1)) * 0.6; // spread branches up the trunk
      const branchStart = [
        trunkBase[0],
        TRUNK_HEIGHT * heightFrac,
        trunkBase[2],
      ];
      // Fan branches outward and sideways from the trunk.
      const sideAngle = (i / n) * Math.PI * 2;
      const spread = 1.6;
      const branchEnd = [
        branchStart[0] + outward[0] * spread + Math.cos(sideAngle) * 0.5,
        branchStart[1] + 0.6 + (i % 2 === 0 ? 0.3 : -0.1),
        branchStart[2] + outward[2] * spread + Math.sin(sideAngle) * 0.5,
      ];
      return { listing, branchStart, branchEnd };
    });

    return {
      category: grove.category,
      trunkBase,
      trunkTop,
      nodes,
    };
  });
}
