import type { FlightState } from "./flight";
import type { Shared } from "./store";

const SPAWN_INTERVAL = 14;
const IMPACT_RADIUS = 32;

/** Only the snapshot host advances hazards and resolves their swept collisions. */
export function stepHazards(s: Shared, f: FlightState, dt: number) {
  if (s.phase !== "flying" || f.onGround || f.crashed) return false;
  s.hazardClock += dt;
  if (s.hazardClock >= SPAWN_INTERVAL && s.hazards.length < 3) {
    s.hazardClock = 0;
    const meteor = s.hazardN % 3 !== 2;
    const aheadX = -Math.sin(f.yaw), aheadZ = -Math.cos(f.yaw);
    const x = f.x + aheadX * 1000 + Math.cos(f.yaw) * 70;
    const z = f.z + aheadZ * 1000 - Math.sin(f.yaw) * 70;
    const y = f.y + (meteor ? 260 : 0);
    const targetX = f.x + aheadX * f.speed * 5 + (Math.random() - 0.5) * 35;
    const targetZ = f.z + aheadZ * f.speed * 5;
    s.hazards.push({ id: ++s.hazardN, kind: meteor ? "meteor" : "wind", x, y, z,
      vx: meteor ? (targetX - x) / 5 : 0,
      vy: meteor ? (f.y - y) / 5 : 0,
      vz: meteor ? (targetZ - z) / 5 : 0, age: 0 });
  }
  s.hazards = s.hazards.filter(h => {
    const dx = h.vx * dt, dy = h.vy * dt, dz = h.vz * dt;
    // Relative swept segment prevents skipping an impact between frame samples.
    const relX = dx + Math.sin(f.yaw) * f.speed * dt;
    const relY = dy - f.vy * dt;
    const relZ = dz + Math.cos(f.yaw) * f.speed * dt;
    const len = relX ** 2 + relY ** 2 + relZ ** 2;
    const t = len ? Math.max(0, Math.min(1, -((h.x - f.x) * relX + (h.y - f.y) * relY + (h.z - f.z) * relZ) / len)) : 0;
    const dist = Math.hypot(h.x - f.x + relX * t, h.y - f.y + relY * t, h.z - f.z + relZ * t);
    h.x += dx; h.y += dy; h.z += dz; h.age += dt;
    if (dist < (h.kind === "wind" ? 110 : IMPACT_RADIUS)) {
      s.hull = Math.max(0, s.hull - (h.kind === "meteor" ? 25 : 8));
      s.turbulence = Math.max(s.turbulence, 5);
      f.ap = false;
      f.roll = Math.max(-0.8, Math.min(0.8, f.roll + (h.id % 2 ? 0.35 : -0.35)));
      f.speed = Math.max(0, f.speed - (h.kind === "meteor" ? 12 : 4));
      s.logN += 1;
      s.log = [...s.log.slice(-5), { n: s.logN, text: h.kind === "meteor" ? "Meteor impact! Aircraft damaged; autopilot off." : "Wind shear! Bank upset; autopilot off." }];
      return false;
    }
    return h.age < 16 && h.y > -50;
  });
  if (s.hull <= 0) { f.crashed = true; f.speed = 0; f.throttle = 0; return true; }
  return false;
}