// @ts-nocheck -- strict index checks relaxed for game math
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { AIRCRAFT, type AircraftId } from "../aircraft";
import { flight } from "../flight";

/** Procedural airliner. Local forward is -Z, wheels touch y = 0. */
export function Airplane({ aircraft, groupRef }: { aircraft: AircraftId; groupRef: React.RefObject<THREE.Group | null> }) {
  const def = AIRCRAFT[aircraft];
  const s = def.scale;
  const len = 30 + def.rows * 1.6;
  const r = 1.9;
  const props = useRef<THREE.Group[]>([]);
  const gear = useRef<THREE.Group>(null);
  const strobe = useRef<THREE.MeshBasicMaterial>(null);

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#f4f5f2", metalness: 0.35, roughness: 0.32 }),
      livery: new THREE.MeshStandardMaterial({ color: def.livery, metalness: 0.3, roughness: 0.35 }),
      wing: new THREE.MeshStandardMaterial({ color: "#d9dcdf", metalness: 0.55, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: "#1d2329", metalness: 0.6, roughness: 0.25 }),
      glass: new THREE.MeshStandardMaterial({ color: "#16202a", metalness: 0.9, roughness: 0.08 }),
      engine: new THREE.MeshStandardMaterial({ color: "#c7cbd0", metalness: 0.75, roughness: 0.22 }),
      tyre: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 }),
    }),
    [def.livery],
  );

  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const span = 14 + def.rows * 0.6;
    shape.moveTo(0, 0);
    shape.lineTo(span, 3.2);
    shape.lineTo(span, 4.6);
    shape.lineTo(0, 6.5);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 2 });
    g.rotateX(Math.PI / 2);
    return g;
  }, [def.rows]);

  const finGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-2.5, 6.5);
    shape.lineTo(-4.2, 6.5);
    shape.lineTo(-5.8, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
    g.rotateY(Math.PI / 2);
    return g;
  }, []);

  useFrame((state, dt) => {
    for (const p of props.current) if (p) p.rotation.z += (6 + flight.throttle * 60) * dt;
    if (gear.current) {
      const target = flight.gear ? 1 : 0.001;
      gear.current.scale.y += (target - gear.current.scale.y) * (1 - Math.exp(-3 * Math.min(dt, 0.05)));
      gear.current.visible = gear.current.scale.y > 0.05;
    }
    if (strobe.current) strobe.current.color.setScalar(Math.sin(state.clock.elapsedTime * 6) > 0.85 ? 4 : 0.1);
  });

  const engineX = 6 + def.rows * 0.25;
  const wingZ = -1;
  const windowCount = Math.floor(len / 1.1);

  return (
    <group ref={groupRef}>
      <group scale={s} position={[0, 0, 0]}>
        <group position={[0, r + 1.5, 0]}>
          {/* fuselage */}
          <mesh castShadow material={mats.body} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[r, r, len, 32]} />
          </mesh>
          {/* belly stripe */}
          <mesh material={mats.livery} rotation-x={Math.PI / 2} position={[0, -0.25, 0]} scale={[1.006, 1, 0.55]}>
            <cylinderGeometry args={[r, r, len * 0.98, 32, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
          </mesh>
          {/* window strip */}
          {Array.from({ length: windowCount }).map((_, i) =>
            [-1, 1].map((side) => (
              <mesh key={`${i}${side}`} material={mats.glass} position={[side * (r - 0.02), 0.45, -len / 2 + 5 + i * 1.0]} rotation-y={(side * Math.PI) / 2}>
                <planeGeometry args={[0.32, 0.45]} />
              </mesh>
            )),
          ).slice(0, Math.floor(len - 9))}
          {/* nose */}
          <mesh castShadow material={mats.body} position={[0, -0.2, -len / 2]} scale={[1, 0.92, 1.9]}>
            <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={mats.body} position={[0, -0.2, -len / 2]} rotation-x={-Math.PI / 2} scale={[1, 1.9, 0.92]}>
            <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* cockpit glass */}
          <mesh material={mats.glass} position={[0, 0.65, -len / 2 - 1.5]} rotation-x={-0.6}>
            <boxGeometry args={[2.2, 0.6, 1.3]} />
          </mesh>
          {/* tail cone */}
          <mesh castShadow material={mats.body} position={[0, 0.5, len / 2 + 3.5]} rotation-x={-Math.PI / 2 + 0.1}>
            <cylinderGeometry args={[0.35, r, 7, 32]} />
          </mesh>
          {/* fin */}
          <mesh castShadow geometry={finGeo} material={mats.livery} position={[-0.15, 1.2, len / 2 - 2.5]} />
          {/* stabilisers */}
          {[-1, 1].map((side) => (
            <mesh key={side} castShadow material={mats.wing} position={[side * 3.2, 1, len / 2 + 4.6]} rotation-y={side * -0.4}>
              <boxGeometry args={[6, 0.25, 2.2]} />
            </mesh>
          ))}
          {/* wings */}
          <mesh castShadow geometry={wingGeo} material={mats.wing} position={[r - 0.4, -0.9, wingZ - 3]} />
          <mesh castShadow geometry={wingGeo} material={mats.wing} position={[-r + 0.4, -0.9, wingZ - 3]} scale={[-1, 1, 1]} />
          {/* winglets */}
          {[-1, 1].map((side) => (
            <mesh key={side} material={mats.livery} position={[side * (r + 13.6 + def.rows * 0.6), 0.1, wingZ + 1.4]} rotation-z={side * -0.25}>
              <boxGeometry args={[0.15, 2.2, 1.2]} />
            </mesh>
          ))}
          {/* engines */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * engineX, def.engines === "jet" ? -1.9 : -0.6, wingZ - 1]}>
              <mesh castShadow material={mats.engine} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[def.engines === "jet" ? 1.15 : 0.7, def.engines === "jet" ? 0.95 : 0.6, def.engines === "jet" ? 4.6 : 5.5, 24]} />
              </mesh>
              <mesh material={mats.dark} position={[0, 0, def.engines === "jet" ? -2.31 : -2.76]}>
                <circleGeometry args={[def.engines === "jet" ? 1.05 : 0.45, 24]} />
              </mesh>
              {def.engines === "prop" && (
                <group ref={(g) => { if (g) props.current[side > 0 ? 0 : 1] = g; }} position={[0, 0, -3]}>
                  {[0, 1, 2, 3, 4, 5].map((b) => (
                    <mesh key={b} material={mats.dark} rotation-z={(b * Math.PI) / 3} position={[0, 0, 0]}>
                      <boxGeometry args={[0.18, 3.6, 0.06]} />
                    </mesh>
                  ))}
                  <mesh material={mats.livery} position={[0, 0, -0.2]} rotation-x={-Math.PI / 2}>
                    <coneGeometry args={[0.4, 0.8, 16]} />
                  </mesh>
                </group>
              )}
            </group>
          ))}
          {/* nav lights */}
          <mesh position={[r + 13.8 + def.rows * 0.6, -0.4, wingZ + 2]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={[0, 3, 0.5]} toneMapped={false} />
          </mesh>
          <mesh position={[-r - 13.8 - def.rows * 0.6, -0.4, wingZ + 2]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={[3, 0, 0]} toneMapped={false} />
          </mesh>
          <mesh position={[0, 7.4, len / 2 + 1.7]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial ref={strobe} toneMapped={false} />
          </mesh>
        </group>
        {/* landing gear */}
        <group ref={gear} position={[0, 0, 0]}>
          {[
            [0, -len / 2 + 2.5],
            [-2.2, 1.2],
            [2.2, 1.2],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh material={mats.dark} position={[0, 1.6, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 2.4, 8]} />
              </mesh>
              <mesh material={mats.tyre} position={[0, 0.5, 0]} rotation-z={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.5, 0.5, i === 0 ? 0.4 : 0.8, 16]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
