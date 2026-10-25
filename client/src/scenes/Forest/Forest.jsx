import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Text, Html, Instances, Instance } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import { TIER_COLORS, CATEGORY_LABELS } from "@agentone/shared";
import { buildForestLayout } from "./layout.js";
import { freshnessLabel } from "../../lib/format.js";

const DIM_COLOR = "#2A332F";

function Trunk({ base, top }) {
  return (
    <Line points={[base, top]} color="#0D9488" lineWidth={2} transparent opacity={0.6} />
  );
}

function Branch({ start, end, dim }) {
  return (
    <Line points={[start, end]} color={dim ? DIM_COLOR : "#34D399"} lineWidth={1} transparent opacity={dim ? 0.15 : 0.45} />
  );
}

function ForestGroup({ layout, query, onHover, hovered }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.03; // slow camera-independent drift
  });

  const matches = (listing) => !query || listing.name.toLowerCase().includes(query.toLowerCase());

  return (
    <group ref={groupRef}>
      {layout.map((grove) => (
        <group key={grove.category}>
          <Trunk base={grove.trunkBase} top={grove.trunkTop} />
          <Text
            position={[grove.trunkTop[0], grove.trunkTop[1] + 0.6, grove.trunkTop[2]]}
            fontSize={0.32}
            color="#8FA39B"
            anchorX="center"
            anchorY="bottom"
          >
            {CATEGORY_LABELS[grove.category]}
          </Text>
          {grove.nodes.map(({ listing, branchStart, branchEnd }) => (
            <Branch key={listing.slug} start={branchStart} end={branchEnd} dim={!matches(listing)} />
          ))}
        </group>
      ))}

      <Instances limit={200}>
        <icosahedronGeometry args={[0.16, 1]} />
        <meshStandardMaterial emissiveIntensity={1.1} roughness={0.3} />
        {layout.flatMap((grove) =>
          grove.nodes.map(({ listing, branchEnd }) => {
            const dim = !matches(listing);
            const color = dim ? DIM_COLOR : (TIER_COLORS[listing.tier] || TIER_COLORS.L0);
            return (
              <Instance
                key={listing.slug}
                position={branchEnd}
                color={color}
                scale={hovered?.slug === listing.slug ? 1.6 : 1}
                onPointerOver={(e) => { e.stopPropagation(); onHover({ listing, position: branchEnd }); }}
                onPointerOut={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onHover({ listing, position: branchEnd, clicked: true }); }}
              />
            );
          })
        )}
      </Instances>
    </group>
  );
}

function HoverCard({ hovered }) {
  const navigate = useNavigate();
  if (!hovered) return null;
  const { listing, position } = hovered;
  return (
    <Html position={position} center distanceFactor={8} style={{ pointerEvents: hovered.clicked ? "auto" : "none" }}>
      <div
        className="glass w-48 cursor-pointer rounded-card p-3 text-xs"
        onClick={() => navigate(`/listing/${listing.slug}`)}
      >
        <p className="font-heading text-sm font-semibold text-ink">{listing.name}</p>
        <p className="mt-0.5 text-ink-muted">{listing.tier}{listing.score != null ? ` · ${Math.round(listing.score)}` : ""}</p>
        <p className="mt-0.5 text-ink-muted">{freshnessLabel(listing.lastVerifiedAt)}</p>
      </div>
    </Html>
  );
}

export default function Forest({ groves, query }) {
  const [hovered, setHovered] = useState(null);
  const layout = useMemo(() => buildForestLayout(groves), [groves]);

  return (
    <div className="h-[520px] w-full">
      <Canvas camera={{ position: [0, 5, 14], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 8, 0]} intensity={40} color="#34D399" />
        <pointLight position={[10, 4, -10]} intensity={30} color="#A78BFA" />
        <ForestGroup layout={layout} query={query} onHover={setHovered} hovered={hovered} />
        <HoverCard hovered={hovered} />
        <OrbitControls
          enablePan={false}
          minDistance={8}
          maxDistance={22}
          autoRotate
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  );
}
