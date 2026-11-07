import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTheme } from "../lib/ThemeContext.jsx";

// Dark theme only: a few slow-drifting wireframe shapes behind everything,
// specifically so the glassmorphism panels (.glass/.glass-chip/.neo-in in
// index.css) have something worth blurring/refracting — a flat black page
// gives backdrop-filter nothing to do. Fixed + transparent, mounted once at
// the app root (not per-page) so it's consistent everywhere dark theme is
// active, including pages with no hero of their own like TestAgent.
function Shape({ position, geometry, color, speed, wireframe = true }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * speed * 0.35;
    ref.current.rotation.y += delta * speed * 0.55;
  });
  return (
    <mesh ref={ref} position={position}>
      {geometry}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} wireframe={wireframe} roughness={0.35} />
    </mesh>
  );
}

export default function TechyBackground() {
  const { theme } = useTheme();
  if (theme !== "dark") return null;

  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 9], fov: 50 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[6, 5, 6]} intensity={35} color="#44ff6e" />
        <pointLight position={[-6, -4, 4]} intensity={22} color="#c0c4c7" />
        <Suspense fallback={null}>
          <Shape position={[-4.2, 2.2, -3]} geometry={<icosahedronGeometry args={[1.3, 0]} />} color="#44ff6e" speed={0.3} />
          <Shape position={[4.6, -1.6, -5]} geometry={<torusGeometry args={[1, 0.32, 16, 48]} />} color="#c0c4c7" speed={0.45} />
          <Shape position={[2.2, 3.1, -7]} geometry={<octahedronGeometry args={[0.95, 0]} />} color="#44ff6e" speed={0.4} />
          <Shape position={[-3.4, -2.6, -6]} geometry={<dodecahedronGeometry args={[0.85, 0]} />} color="#8f9396" speed={0.25} />
          <Shape position={[0.5, -0.5, -9]} geometry={<torusKnotGeometry args={[0.7, 0.2, 100, 16]} />} color="#44ff6e" speed={0.2} wireframe={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
