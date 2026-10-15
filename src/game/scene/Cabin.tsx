// @ts-nocheck -- strict index checks relaxed for game math
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AIRCRAFT } from "../aircraft";
import { boardingPos, clampWalk, DOOR, layout, PITCH, SEAT_X, seatPos, Z0 } from "../cabinLayout";
import { me, remotes } from "../controller";
import { gamepadAxes, keys } from "../input";
import { passengerPosition, rescueTarget } from "../rescue";
import { useGame, type Need, type Passenger } from "../store";
import { carpetTexture, fabricTexture } from "../textures";

const ITEM_COLOR: Record<Need, string> = { drink: "#4fb3e8", meal: "#e8a33d", blanket: "#c0504d" };
const R = 1.75;
const CY = 1.15;

export function Cabin() {
  const shared = useGame((s) => s.shared);
  const rows = AIRCRAFT[shared?.aircraft ?? "hopper"].rows;
  const { zEnd, L, galleyZ } = layout(rows);
  const { camera, scene, gl } = useThree();
  const lookPitch = useRef(0);
  
  const sky = skyColor(shared?.timeOfDay ?? 14, shared?.weather ?? "clear", shared?.phase ?? "boarding");

  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.near = 0.05;
    c.far = 200;
    c.fov = 70;
    c.updateProjectionMatrix();
    c.up.set(0, 1, 0);
    scene.background = new THREE.Color("#0d1420");
    return () => {
      scene.background = null;
    };
  }, [camera, scene]);

  useEffect(() => {
    const canvas = gl.domElement;
    const lock = () => { void canvas.requestPointerLock()?.catch(() => {}); };
    const look = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      me.ry -= e.movementX * 0.002;
      lookPitch.current = Math.max(-1.1, Math.min(1.1, lookPitch.current - e.movementY * 0.002));
    };
    canvas.addEventListener("click", lock);
    document.addEventListener("mousemove", look);
    return () => {
      canvas.removeEventListener("click", lock);
      document.removeEventListener("mousemove", look);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const gp = gamepadAxes();
    let turn = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
    let move = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    if (gp) {
      turn -= gp.lx;
      move -= gp.ly;
    }
    me.ry += turn * 2.6 * dt;
    const sp = 2.4 * move * dt;
    const n = clampWalk(me.x - Math.sin(me.ry) * sp, me.z - Math.cos(me.ry) * sp, rows);
    me.x = n.x;
    me.z = n.z;
    const turb = useGame.getState().shared?.turbulence ?? 0;
    camera.position.set(me.x, 1.62 + (move ? Math.sin(state.clock.elapsedTime * 9) * 0.018 : 0), me.z);
    camera.up.set(0, 1, 0);
    camera.rotation.set(lookPitch.current, me.ry, 0, "YXZ");
    if (turb > 0) camera.position.y += Math.sin(state.clock.elapsedTime * 17) * 0.025;
    updatePrompt(rows, galleyZ);
  });

  const carpet = useMemo(() => {
    const t = carpetTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(2, L / 1.5);
    return t;
  }, [L]);

  return (
    <>
      <ambientLight intensity={0.55} color="#fff4e6" />
      <hemisphereLight args={["#fff8ec", "#3a3f55", 0.5]} />
      {Array.from({ length: Math.ceil(L / 3) }).map((_, i) => (
        <pointLight key={i} position={[0, 2.3, 1 + i * 3]} intensity={2.2} distance={5} color="#ffe9cc" />
      ))}
      {/* fuselage tube */}
      <mesh position={[0, CY, L / 2]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[R, R, L, 36, 1, true]} />
        <meshStandardMaterial color="#ece7dd" roughness={0.7} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0, L / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.7, L]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      {/* front bulkhead with cockpit door and rear wall */}
      <mesh position={[0, CY, 0]}>
        <circleGeometry args={[R, 36]} />
        <meshStandardMaterial color="#d8d1c3" />
      </mesh>
      <mesh position={[0.3, 1, 0.02]}>
        <planeGeometry args={[0.8, 1.95]} />
        <meshStandardMaterial color="#59616b" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, CY, L]} rotation-y={Math.PI}>
        <circleGeometry args={[R, 36]} />
        <meshStandardMaterial color="#d8d1c3" />
      </mesh>
      {/* cabin door */}
      <CabinDoor />
      <Seats rows={rows} />
      <Bins rows={rows} L={L} />
      <Windows rows={rows} color={sky} />
      {/* ceiling light strip */}
      <mesh position={[0, 2.62, L / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[0.35, L - 1]} />
        <meshBasicMaterial color={[1.6, 1.45, 1.2]} toneMapped={false} />
      </mesh>
      <SeatbeltSigns rows={rows} />
      {/* galley */}
      <group position={[0, 0, zEnd + 0.6]}>
        <mesh position={[-0.75, 0.5, 1.6]}>
          <boxGeometry args={[1.2, 1, 1.6]} />
          <meshStandardMaterial color="#c4c9cf" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-0.75, 1.02, 1.6]}>
          <boxGeometry args={[1.25, 0.05, 1.65]} />
          <meshStandardMaterial color="#8f969e" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-1.0, 1.65, 1.6]}>
          <boxGeometry args={[0.6, 0.8, 1.6]} />
          <meshStandardMaterial color="#dfe3e6" metalness={0.4} roughness={0.35} />
        </mesh>
        {/* cups / trays */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.5, 1.12, 1.1 + i * 0.4]}>
            <cylinderGeometry args={[0.05, 0.04, 0.12, 10]} />
            <meshStandardMaterial color={Object.values(ITEM_COLOR)[i]} />
          </mesh>
        ))}
        {/* service cart */}
        <mesh position={[-0.75, 0.5, 0.45]}>
          <boxGeometry args={[0.4, 0.95, 0.8]} />
          <meshStandardMaterial color="#9aa2aa" metalness={0.7} roughness={0.25} />
        </mesh>
        {/* lavatory */}
        <mesh position={[0.85, 1, 1.6]}>
          <boxGeometry args={[0.9, 2, 1.6]} />
          <meshStandardMaterial color="#e8e3d9" />
        </mesh>
        <mesh position={[0.39, 1, 1.6]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.7, 1.8]} />
          <meshStandardMaterial color="#b6bcc2" />
        </mesh>
        <Html position={[0.38, 2.05, 1.6]} center transform scale={0.12} rotation-y={-Math.PI / 2}>
          <div className="rounded bg-card px-2 py-1 text-xs font-semibold text-card-foreground">🚻 Lavatory</div>
        </Html>
        <Html position={[-0.7, 1.9, 0.6]} center distanceFactor={5}>
          <div className="whitespace-nowrap rounded-md bg-hud/90 px-2 py-1 text-[11px] font-semibold text-hud-foreground">Galley</div>
        </Html>
      </group>
      <Passengers />

      <RemoteAvatars />
    </>
  );
}

function skyColor(time: number, weather: string, phase: string) {
  if (phase === "boarding" || phase === "ready" || phase === "results") return "#9fb7c9";
  if (weather === "storm") return "#6c7680";
  if (time > 18) return "#f0a070";
  return weather === "cloudy" ? "#c6d3de" : "#8cc3ef";
}

let lastPrompt: string | null = null;
function updatePrompt(rows: number, galleyZ: number) {
  const st = useGame.getState();
  const s = st.shared;
  let p: string | null = null;
  if (s) {
    if (me.z < 0.9 && Math.abs(me.x - 0.3) < 0.7) p = "E · Enter cockpit";
    if (Math.hypot(me.x - DOOR.x, me.z - DOOR.z) < 0.9 && s.phase === "boarding" && !s.doorClosed) {
      p = s.passengers.every((x) => x.progress >= 1) ? "E · Close & arm cabin door" : "Wait for all passengers to board…";
    }

    const best = rescueTarget(s.passengers, me.x, me.z);
    if (best) p = `Hold E · Pull ${best.name} back — ${Math.round(best.hold * 100)}%`;
    void rows;
  }
  if (p !== lastPrompt) {
    lastPrompt = p;
    st.set({ prompt: p });
  }
}

function CabinDoor() {
  const closed = useGame((s) => (s.shared?.doorClosed ?? false) && !s.shared?.passengers.some(p => p.escape !== null && !p.lost && p.escape > 0.65));
  return (
    <group position={[-1.38, 1, DOOR.z]}>
      <mesh rotation-y={Math.PI / 2} position={[closed ? 0 : 0.02, 0, 0]}>
        <planeGeometry args={[0.95, 1.9]} />
        <meshStandardMaterial color={closed ? "#c9ced3" : "#bfe0f5"} emissive={closed ? "#000000" : "#9fd0ef"} emissiveIntensity={closed ? 0 : 0.6} />
      </mesh>
      {!closed && (
        <Html position={[0.1, 1.15, 0]} center distanceFactor={5}>
          <div className="whitespace-nowrap rounded-md bg-signal px-2 py-1 text-[11px] font-bold text-signal-foreground">Exit open</div>
        </Html>
      )}
    </group>
  );
}

function Seats({ rows }: { rows: number }) {
  const n = rows * 4;
  const base = useRef<THREE.InstancedMesh>(null);
  const back = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const fabric = fabricTexture();
  useEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const { x, z } = seatPos(i);
      m.makeTranslation(x, 0.42, z);
      base.current?.setMatrixAt(i, m);
      m.makeRotationX(-0.12).setPosition(x, 0.85, z + 0.27);
      back.current?.setMatrixAt(i, m);
      m.makeTranslation(x, 1.28, z + 0.32);
      head.current?.setMatrixAt(i, m);
    }
    for (const r of [base, back, head]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, [n]);
  return (
    <>
      <instancedMesh ref={base} args={[undefined, undefined, n]} key={`b${n}`}>
        <boxGeometry args={[0.46, 0.16, 0.5]} />
        <meshStandardMaterial map={fabric} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={back} args={[undefined, undefined, n]} key={`k${n}`}>
        <boxGeometry args={[0.46, 0.8, 0.12]} />
        <meshStandardMaterial map={fabric} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, n]} key={`h${n}`}>
        <boxGeometry args={[0.4, 0.14, 0.13]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function Bins({ rows, L }: { rows: number; L: number }) {
  const len = rows * PITCH + 0.4;
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 1.18, 2.05, Z0 - 0.4 + len / 2]}>
            <boxGeometry args={[0.7, 0.42, len]} />
            <meshStandardMaterial color="#f3efe7" roughness={0.55} />
          </mesh>
          {Array.from({ length: rows }).map((_, r) => (
            <mesh key={r} position={[side * 0.83, 2.05, Z0 + r * PITCH]}>
              <boxGeometry args={[0.01, 0.3, 0.02]} />
              <meshStandardMaterial color="#9aa0a6" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.005, L / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.04, L - 1]} />
        <meshBasicMaterial color={[1.2, 0.9, 0.5]} toneMapped={false} />
      </mesh>
    </>
  );
}

function Windows({ rows, color }: { rows: number; color: string }) {
  return (
    <>
      {Array.from({ length: rows + 1 }).map((_, r) =>
        [-1, 1].map((side) => (
          <group key={`${r}${side}`} position={[side * 1.66, 1.25, Z0 - 0.2 + r * PITCH]} rotation-y={(-side * Math.PI) / 2}>
            <mesh>
              <planeGeometry args={[0.34, 0.46]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[0.46, 0.58]} />
              <meshStandardMaterial color="#d4cec2" />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}

function SeatbeltSigns({ rows }: { rows: number }) {
  const on = useGame((s) => s.shared?.seatbelt ?? false);
  return (
    <>
      {Array.from({ length: Math.ceil(rows / 2) }).map((_, i) => (
        <mesh key={i} position={[0, 2.48, Z0 + i * PITCH * 2]} rotation-x={Math.PI / 2}>
          <planeGeometry args={[0.18, 0.1]} />
          <meshBasicMaterial color={on ? [2.4, 1.6, 0.3] : [0.25, 0.25, 0.25]} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function Passengers() {
  const passengers = useGame((s) => s.shared?.passengers ?? []);
  return (
    <>
      {passengers.map((p) => (
        <PassengerView key={`${p.id}-${p.seat}-${p.name}`} p={p} />
      ))}
    </>
  );
}

function PassengerView({ p }: { p: Passenger }) {
  const g = useRef<THREE.Group>(null);
  const shown = useRef(p.progress);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState().shared;
    const live = st?.passengers.find((x) => x.id === p.id);
    const target = live ? live.progress : p.progress;
    shown.current += (target - shown.current) * (1 - Math.exp(-5 * dt));
    if (!g.current) return;
    const vis = shown.current > 0.001 && !live?.lost;
    g.current.visible = vis;
    if (!vis) return;
    const escaping = live?.escape !== null && live?.escape !== undefined;
    const pos = escaping && live ? passengerPosition(live) : shown.current >= 0.995 ? { ...seatPos(p.seat), ry: 0 } : boardingPos(p.seat, shown.current);
    g.current.position.set(pos.x, 0, pos.z + (shown.current >= 0.995 ? 0.05 : 0));
    g.current.rotation.y = pos.ry;
    const turb = st?.turbulence ?? 0;
    if (turb > 0) g.current.position.y = Math.sin(state.clock.elapsedTime * 14 + p.id) * 0.03;
  });
  const seated = p.progress >= 1 && p.escape === null;
  const moodColor = p.mood > 65 ? "bg-ok" : p.mood > 40 ? "bg-signal" : "bg-destructive";
  return (
    <group ref={g}>
      <Person shirt={p.color} skin={p.skin} hair={p.hair} seated={seated} />
      {p.escape !== null && !p.lost && (
        <Html position={[0, 1.65, 0]} center distanceFactor={4}>
          <div className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-sm font-bold text-hud-foreground shadow-lg ${moodColor}`}>
            <span>⚠ {Math.round(p.hold * 100)}%</span>
            <span className="text-[10px]">{p.name}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Person({ shirt, skin, hair, seated, crew, carry }: { shirt: string; skin: string; hair: string; seated: boolean; crew?: boolean; carry?: Need | null }) {
  const y = seated ? -0.38 : 0;
  return (
    <group position={[0, y, 0]}>
      {/* legs */}
      {!seated &&
        [-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.42, 0]}>
            <capsuleGeometry args={[0.065, 0.62, 4, 8]} />
            <meshStandardMaterial color={crew ? "#141c2e" : "#2f3640"} />
          </mesh>
        ))}
      {seated && (
        <mesh position={[0, 0.88, -0.2]} rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.09, 0.32, 4, 8]} />
          <meshStandardMaterial color="#2f3640" />
        </mesh>
      )}
      <mesh position={[0, 1.08, 0]}>
        <capsuleGeometry args={[0.17, 0.42, 6, 12]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {crew && (
        <mesh position={[0, 1.22, -0.16]}>
          <boxGeometry args={[0.06, 0.18, 0.02]} />
          <meshStandardMaterial color="#e2622f" />
        </mesh>
      )}
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.58, 0.02]} scale={[1.05, 0.75, 1.05]}>
        <sphereGeometry args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={crew ? "#1d2b4a" : hair} roughness={0.9} />
      </mesh>
      {crew && (
        <mesh position={[0, 1.66, 0]}>
          <cylinderGeometry args={[0.13, 0.14, 0.06, 16]} />
          <meshStandardMaterial color="#1d2b4a" />
        </mesh>
      )}
      {carry && (
        <mesh position={[0.18, 1.0, -0.22]}>
          <boxGeometry args={carry === "meal" ? [0.3, 0.05, 0.22] : carry === "blanket" ? [0.25, 0.12, 0.18] : [0.08, 0.14, 0.08]} />
          <meshStandardMaterial color={ITEM_COLOR[carry]} />
        </mesh>
      )}
    </group>
  );
}

function RemoteAvatars() {
  const [ids, setIds] = useState<string[]>([]);
  const groups = useRef(new Map<string, THREE.Group>());
  const names = useGame((s) => s.shared?.names ?? {});
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const list = [...remotes.entries()].filter(([, r]) => r.inCabin).map(([id]) => id);
    if (list.join() !== ids.join()) setIds(list);
    const k = 1 - Math.exp(-12 * dt);
    for (const id of list) {
      const r = remotes.get(id);
      const g = groups.current.get(id);
      if (!g || !r) continue;
      g.position.x += (r.x - g.position.x) * k;
      g.position.z += (r.z - g.position.z) * k;
      const dy = r.ry - g.rotation.y;
      g.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * k;
    }
  });
  return (
    <>
      {ids.map((id) => (
        <group key={id} ref={(g) => { if (g) groups.current.set(id, g); else groups.current.delete(id); }}>
          <Person shirt="#7a1f3d" skin="#d9a47c" hair="#1a1a1a" crew seated={false} carry={remotes.get(id)?.carry ?? null} />
          <Html position={[0, 2, 0]} center distanceFactor={5}>
            <div className="whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{names[id] ?? "Crew"}</div>
          </Html>
        </group>
      ))}
    </>
  );
}

export { SEAT_X };
