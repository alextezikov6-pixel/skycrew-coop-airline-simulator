import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { useGame, type Hazard } from "../store";

function HazardView({ hazard, signal, rock }: { hazard: Hazard; signal: string; rock: string }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    const live = useGame.getState().shared?.hazards.find(h => h.id === hazard.id);
    if (!g || !live) return;
    const k = 1 - Math.exp(-12 * Math.min(delta, 0.05));
    g.position.x += (live.x - g.position.x) * k;
    g.position.y += (live.y - g.position.y) * k;
    g.position.z += (live.z - g.position.z) * k;
    g.rotation.z += Math.min(delta, 0.05) * 0.7;
  });
  return <group ref={group} position={[hazard.x, hazard.y, hazard.z]}>
    {hazard.kind === "meteor" ? <>
      <mesh scale={[1, 0.85, 1.2]} castShadow><icosahedronGeometry args={[12, 1]} /><meshStandardMaterial color={rock} emissive={signal} emissiveIntensity={0.6} roughness={0.9} flatShading /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[-hazard.vx * i * 0.17, -hazard.vy * i * 0.17, -hazard.vz * i * 0.17]}><icosahedronGeometry args={[11 - i * 2, 0]} /><meshBasicMaterial color={signal} transparent opacity={0.4 - i * 0.08} depthWrite={false} /></mesh>)}
    </> : [0, 1, 2].map(i => <mesh key={i} rotation={[Math.PI / 2 + i * 0.15, 0, i]}><torusGeometry args={[75 + i * 12, 2, 4, 40]} /><meshBasicMaterial color={signal} transparent opacity={0.4} depthWrite={false} /></mesh>)}
  </group>;
}

export function Hazards() {
  const hazards = useGame(s => s.shared?.hazards ?? []);
  const [palette, setPalette] = useState<{ signal: string; rock: string } | null>(null);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setPalette({ signal: css.getPropertyValue("--meteor-fire").trim(), rock: css.getPropertyValue("--meteor-rock").trim() });
  }, []);
  if (!palette) return null;
  return hazards.map(h => <HazardView key={h.id} hazard={h} {...palette} />);
}