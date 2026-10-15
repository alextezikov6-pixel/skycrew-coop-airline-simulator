// @ts-nocheck -- strict index checks relaxed for game math
import { Environment, Lightformer, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AIRCRAFT, DEST, RUNWAY_LEN, RUNWAY_W, routeDetails } from "../aircraft";
import { flight } from "../flight";
import { useGame } from "../store";
import {
  asphaltTexture, cloudSprite, fieldsTexture, grassTexture, runwayTexture, thresholdTexture, windowsTexture,
} from "../textures";
import { Airplane } from "./Airplane";
import { Hazards } from "./Hazards";

export function sunFor(time: number) {
  const a = ((time - 6) / 12) * Math.PI; // 6h sunrise .. 18h sunset
  const elev = Math.sin(a);
  return new THREE.Vector3(Math.cos(a) * 1000, Math.max(elev, -0.15) * 900 + 30, -400);
}

export function World() {
  const shared = useGame((s) => s.shared);
  const cam = useGame((s) => s.cam);
  const weather = shared?.weather ?? "clear";
  const time = shared?.timeOfDay ?? 16;
  const aircraft = shared?.aircraft ?? "hopper";
  const route = routeDetails(shared?.routeIdx ?? 0);
  const plane = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const { camera, scene } = useThree();

  const sun = useMemo(() => sunFor(time), [time]);
  const dusk = time > 18 || time < 7.5;
  const fogColor = weather === "storm" ? "#7d8790" : dusk ? "#e8b48f" : weather === "cloudy" ? "#b9c6d1" : "#c8dbea";

  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.near = 0.5;
    c.far = 40000;
    c.fov = 60;
    c.updateProjectionMatrix();
    scene.background = null;
  }, [camera, scene]);

  const camPos = useRef(new THREE.Vector3(0, 10, 300));
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, "YXZ"), v: new THREE.Vector3(), l: new THREE.Vector3() }), []);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const g = plane.current;
    if (!g) return;
    g.position.set(flight.x, flight.y, flight.z);
    tmp.e.set(flight.pitch, flight.yaw, -flight.roll);
    g.quaternion.setFromEuler(tmp.e);

    const turb = useGame.getState().shared?.turbulence ?? 0;
    const shake = turb > 0 ? 0.35 : 0;
    const t = state.clock.elapsedTime;
    if (turb > 0 && !flight.onGround) g.position.y += Math.sin(t * 13) * 0.4 + Math.sin(t * 7.3) * 0.3;

    const sc = AIRCRAFT[aircraft].scale;
    if (cam === "cockpit") {
      const len = 30 + AIRCRAFT[aircraft].rows * 1.6;
      tmp.v.set(0, (1.9 + 1.5 + 0.9) * sc, (-len / 2 - 1.2) * sc).applyQuaternion(g.quaternion).add(g.position);
      camera.position.copy(tmp.v);
      tmp.l.set(0, 0, -100).applyQuaternion(g.quaternion).add(tmp.v);
      camera.up.set(0, 1, 0).applyQuaternion(g.quaternion);
      camera.lookAt(tmp.l);
    } else {
      tmp.q.setFromEuler(new THREE.Euler(0, flight.yaw, 0));
      tmp.v.set(12 * sc, 17 * sc, 65 * sc).applyQuaternion(tmp.q).add(g.position);
      const k = 1 - Math.exp(-4 * dt);
      camPos.current.lerp(tmp.v, k);
      if (camPos.current.distanceTo(tmp.v) > 300) camPos.current.copy(tmp.v);
      camPos.current.y = Math.max(camPos.current.y, 1.5);
      camera.position.copy(camPos.current);
      camera.up.set(0, 1, 0);
      tmp.l.set(0, 3 * sc, -4).applyQuaternion(tmp.q).add(g.position);
      camera.lookAt(tmp.l);
    }
    if (shake) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }

    if (light.current) {
      light.current.position.copy(g.position).add(sun.clone().normalize().multiplyScalar(200));
      light.current.target.position.copy(g.position);
      light.current.target.updateMatrixWorld();
    }
  });

  const sunI = weather === "storm" ? 0.6 : weather === "cloudy" ? 1.4 : 2.4;

  return (
    <>
      <Sky sunPosition={sun} turbidity={weather === "storm" ? 18 : 6} rayleigh={dusk ? 3 : 1.2} mieCoefficient={0.006} mieDirectionalG={0.85} distance={30000} />
      <fog attach="fog" args={[fogColor, weather === "storm" ? 300 : 1500, weather === "storm" ? 5000 : 14000]} />
      <hemisphereLight args={[dusk ? "#ffd2b0" : "#dbe9ff", "#5b6b3a", weather === "storm" ? 0.7 : 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        intensity={sunI}
        color={dusk ? "#ffc08a" : "#fff6e8"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
      />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 10, 0]} scale={[20, 20, 1]} rotation-x={Math.PI / 2} color={dusk ? "#ffd9b8" : "#ffffff"} />
        <Lightformer intensity={1.2} position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[30, 3, 1]} color="#9cc4e8" />
        <Lightformer intensity={0.6} position={[10, -2, 0]} rotation-y={-Math.PI / 2} scale={[30, 3, 1]} color="#7a8f5a" />
      </Environment>

      <Ground />
      <RouteLandscape distance={route.distance} terrain={route.terrain} />
      <Airport z={0} />
      <Airport z={-route.distance} />
      <Trees />
      <Hills key={shared?.routeIdx} distance={route.distance} terrain={route.terrain} />
      <CloudField weather={weather} />
      {weather === "storm" && <Rain />}
      <Airplane aircraft={aircraft} groupRef={plane} />
      <Hazards />
    </>
  );
}

function Ground() {
  const fields = fieldsTexture();
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, -DEST / 2]} receiveShadow>
      <planeGeometry args={[80000, 80000]} />
      <meshStandardMaterial map={fields} roughness={1} />
    </mesh>
  );
}

function Airport({ z }: { z: number }) {
  const grass = grassTexture();
  const rwy = runwayTexture();
  const thr = thresholdTexture();
  const asphalt = asphaltTexture();
  const glass = windowsTexture();
  const carts = useMemo(() => Array.from({ length: 10 }, (_, i) => [130 + (i % 5) * 7, -60 + Math.floor(i / 5) * 40 + Math.random() * 10]), []);
  return (
    <group position={[0, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position={[60, 0.01, 0]} receiveShadow>
        <planeGeometry args={[420, RUNWAY_LEN + 500]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} receiveShadow>
        <planeGeometry args={[RUNWAY_W, RUNWAY_LEN]} />
        <meshStandardMaterial map={rwy} roughness={0.85} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} rotation-z={s > 0 ? 0 : Math.PI} position={[0, 0.07, s * (RUNWAY_LEN / 2 - 25)]}>
          <planeGeometry args={[RUNWAY_W, 40]} />
          <meshStandardMaterial map={thr} roughness={0.85} />
        </mesh>
      ))}
      {/* approach lights */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[0, 0.6, RUNWAY_LEN / 2 + 30 + i * 30]}>
          <boxGeometry args={[14, 0.5, 0.6]} />
          <meshBasicMaterial color={[2.5, 2.2, 1.6]} toneMapped={false} />
        </mesh>
      ))}
      {/* taxiway + apron */}
      <mesh rotation-x={-Math.PI / 2} position={[60, 0.04, 0]} receiveShadow>
        <planeGeometry args={[22, RUNWAY_LEN * 0.8]} />
        <meshStandardMaterial map={asphalt} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[140, 0.045, 0]} receiveShadow>
        <planeGeometry args={[120, 420]} />
        <meshStandardMaterial map={asphalt} roughness={0.9} />
      </mesh>
      {/* terminal */}
      <group position={[230, 0, 0]}>
        <mesh castShadow receiveShadow position={[0, 9, 0]}>
          <boxGeometry args={[50, 18, 380]} />
          <meshStandardMaterial color="#e7e2d8" roughness={0.6} />
        </mesh>
        <mesh position={[-25.1, 10, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[380, 10]} />
          <meshStandardMaterial map={glass} metalness={0.6} roughness={0.15} />
        </mesh>
        <mesh castShadow position={[0, 19, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[30, 30, 384, 24, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#b9c3c9" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* jet bridges */}
        {[-120, -40, 40, 120].map((gz) => (
          <mesh key={gz} castShadow position={[-45, 5.5, gz]}>
            <boxGeometry args={[40, 3.5, 3.5]} />
            <meshStandardMaterial color="#cfd3d6" metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* control tower */}
      <group position={[200, 0, -260]}>
        <mesh castShadow position={[0, 22, 0]}>
          <cylinderGeometry args={[3.5, 5, 44, 16]} />
          <meshStandardMaterial color="#e5e1d6" />
        </mesh>
        <mesh position={[0, 47, 0]}>
          <cylinderGeometry args={[8, 6, 6, 8]} />
          <meshStandardMaterial color="#1c2b36" metalness={0.8} roughness={0.1} />
        </mesh>
        <mesh position={[0, 51, 0]}>
          <cylinderGeometry args={[8.5, 8.5, 1.5, 8]} />
          <meshStandardMaterial color="#d24a2a" />
        </mesh>
      </group>
      {/* hangars */}
      {[200, 330].map((hz) => (
        <mesh key={hz} castShadow position={[170, 0, hz]} rotation-x={Math.PI / 2} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[18, 18, 60, 20, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#8d9aa3" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* baggage carts */}
      {carts.map(([x, cz], i) => (
        <group key={i} position={[x, 0, cz]}>
          <mesh castShadow position={[0, 0.8, 0]}>
            <boxGeometry args={[2, 1.2, 3]} />
            <meshStandardMaterial color={i % 3 ? "#3b6ea5" : "#e3a62f"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Trees() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const COUNT = 1600;
  useEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      let x = 0;
      let z = 0;
      do {
        x = (Math.random() - 0.5) * 8000;
        z = 2500 - Math.random() * (DEST + 5000);
      } while ((Math.abs(x - 60) < 420 && (Math.abs(z) < 1300 || Math.abs(z + DEST) < 1300)) || Math.abs(x) < 60);
      const s = 6 + Math.random() * 10;
      m.makeScale(s * 0.6, s, s * 0.6).setPosition(x, s * 0.5 + 2, z);
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, c.setHSL(0.27 + Math.random() * 0.08, 0.45, 0.22 + Math.random() * 0.12));
      m.makeScale(1, 3, 1).setPosition(x, 1.5, z);
      trunks.current!.setMatrixAt(i, m);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
    trunks.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, COUNT]}>
        <cylinderGeometry args={[0.4, 0.5, 1, 5]} />
        <meshStandardMaterial color="#5a4030" />
      </instancedMesh>
    </>
  );
}

function Hills({ distance, terrain }: { distance: number; terrain: string }) {
  const hills = useMemo(
    () =>
      Array.from({ length: terrain === "alpine" ? 26 : 12 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        return {
          x: side * (5000 + Math.random() * 9000),
          z: 4000 - Math.random() * (distance + 10000),
          r: 1500 + Math.random() * 2500,
          h: (terrain === "alpine" ? 800 : 250) + Math.random() * (terrain === "alpine" ? 1600 : 450),
          snow: terrain === "alpine",
        };
      }),
    [distance, terrain],
  );
  return (
    <>
      {hills.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]}>
          <mesh>
            <coneGeometry args={[h.r, h.h, 28]} />
            <meshStandardMaterial color="#5f6e58" flatShading roughness={1} />
          </mesh>
          {h.snow && (
            <mesh position={[0, h.h * 0.36, 0]}>
              <coneGeometry args={[h.r * 0.28, h.h * 0.28, 28]} />
              <meshStandardMaterial color="#f2f4f6" flatShading />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function CloudField({ weather }: { weather: string }) {
  const tex = cloudSprite();
  const count = weather === "clear" ? 110 : weather === "cloudy" ? 260 : 340;
  const clouds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 14000,
        y: 450 + Math.random() * 350,
        z: 3000 - Math.random() * (DEST + 6000),
        s: 250 + Math.random() * 450,
      })),
    [count],
  );
  const color = weather === "storm" ? "#8d959c" : "#ffffff";
  return (
    <group>
      {clouds.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.55, 1]}>
          <spriteMaterial map={tex} color={color} transparent depthWrite={false} opacity={weather === "storm" ? 0.95 : 0.85} fog />
        </sprite>
      ))}
    </group>
  );
}

function Rain() {
  const ref = useRef<THREE.Points>(null);
  const N = 3000;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.5) * 200;
      p[i * 3 + 1] = Math.random() * 120;
      p[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const pts = ref.current;
    if (!pts) return;
    pts.position.set(flight.x, Math.max(0, flight.y - 60), flight.z);
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      let y = a.getY(i) - 90 * dt;
      if (y < 0) y += 120;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#c9d6e2" size={0.35} transparent opacity={0.6} />
    </points>
  );
}

function RouteLandscape({ distance, terrain }: { distance: number; terrain: string }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(8000, distance + 6000, 48, 80);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const edge = Math.max(0, Math.min(1, (Math.abs(x) - 450) / 1500));
      pos.setZ(i, edge * (35 + 28 * Math.sin(x * 0.003) * Math.cos(y * 0.002)));
    }
    geo.computeVertexNormals(); return geo;
  }, [distance]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} position={[0, -0.03, -distance / 2]} receiveShadow>
      <meshStandardMaterial map={fieldsTexture()} roughness={1} />
    </mesh>
    {(terrain === "coast" || terrain === "islands") && <mesh rotation-x={-Math.PI / 2} position={[-5100, 0.1, -distance / 2]}>
      <planeGeometry args={[7500, distance + 9000, 1, 1]} />
      <meshStandardMaterial color="#2b98b7" metalness={0.55} roughness={0.23} />
    </mesh>}
  </>;
}
