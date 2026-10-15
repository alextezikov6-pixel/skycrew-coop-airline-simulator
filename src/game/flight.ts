import { CRUISE_ALT, DEST, RUNWAY_LEN, RUNWAY_W, type AircraftDef } from "./aircraft";

export interface FlightState {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number; vy: number; throttle: number;
  gear: boolean; flaps: boolean; ap: boolean; brake: boolean;
  onGround: boolean; airborne: boolean; parkedT: number; crashed: boolean;
}

export const flight: FlightState = makeFlight();

function makeFlight(): FlightState {
  return {
    x: 0, y: 0, z: RUNWAY_LEN / 2 - 60, yaw: 0, pitch: 0, roll: 0,
    speed: 0, vy: 0, throttle: 0, gear: true, flaps: true, ap: false, brake: true,
    onGround: true, airborne: false, parkedT: 0, crashed: false,
  };
}

export function resetFlight() {
  Object.assign(flight, makeFlight());
}

/** Target for interpolating a remote pilot's plane. */
export const remotePlane = { ...makeFlight(), has: false };

export interface FlightInput {
  thr: number; // -1..1
  pitch: number; // -1..1 (+ = nose up)
  roll: number; // -1..1 (+ = bank right)
}

export type FlightEvent =
  | { t: "takeoff" }
  | { t: "touchdown"; vs: number; ok: boolean; reason: string };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function onDestRunway(x: number, z: number, distance = DEST) {
  return Math.abs(x) < RUNWAY_W / 2 + 8 && Math.abs(z + distance) < RUNWAY_LEN / 2 + 30;
}
export function distToDest(f: FlightState, distance = DEST) {
  return Math.hypot(f.x, f.z + distance - RUNWAY_LEN / 2 + 200);
}

export function stepFlight(
  f: FlightState,
  input: FlightInput,
  ac: AircraftDef,
  dt: number,
  opts: { locked: boolean; maxVs: number; distance?: number; altitude?: number },
): FlightEvent | null {
  let ev: FlightEvent | null = null;
  if (f.crashed) return null;
  if (opts.locked) {
    f.speed = Math.max(0, f.speed - 8 * dt);
    f.throttle = Math.max(0, f.throttle - dt);
    if (f.onGround) return null;
  }

  // Autopilot overrides inputs while airborne
  if (f.ap && !f.onGround) {
    const dx = 0 - f.x;
    const dz = -(opts.distance ?? DEST) + RUNWAY_LEN / 2 - f.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    let err = desiredYaw - f.yaw;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const targetRoll = clamp(-err * 2, -0.45, 0.45);
    input = { ...input, roll: clamp((targetRoll - f.roll) * 3, -1, 1) };
    const targetVs = clamp(((opts.altitude ?? CRUISE_ALT) - f.y) * 0.08, -12, 12);
    const targetPitch = Math.asin(clamp(targetVs / Math.max(f.speed, 1), -0.3, 0.3));
    input.pitch = clamp((targetPitch - f.pitch) * 4, -1, 1);
    const targetThr = clamp(0.55 + (ac.cruise - f.speed) * 0.02, 0.2, 1);
    f.throttle += clamp(targetThr - f.throttle, -0.3 * dt, 0.3 * dt);
  } else if (!opts.locked) {
    f.throttle = clamp(f.throttle + input.thr * 0.45 * dt, 0, 1);
  }

  const stall = ac.rotate * (f.flaps ? 0.82 : 1);
  const thrust = f.throttle * ac.accel;
  let drag = ac.accel * 0.92 * (f.speed / ac.cruise) ** 2;
  if (f.gear) drag += 0.5;
  if (f.flaps) drag += 0.9 * (f.speed / ac.cruise) ** 2 * ac.accel * 0.3;
  if (f.onGround) drag += f.brake ? 5 : 0.25;
  const gravityAlongPath = f.onGround ? 0 : 9.8 * Math.sin(f.pitch) * 0.6;
  f.speed = Math.max(0, f.speed + (thrust - drag - gravityAlongPath) * dt);

  if (f.onGround) {
    // steer on ground with roll input
    f.yaw -= input.roll * 0.25 * dt * Math.min(1, f.speed / 10);
    if (f.speed > stall && input.pitch > 0) f.pitch = Math.min(0.22, f.pitch + 0.3 * dt);
    else f.pitch = Math.max(0, f.pitch - 0.4 * dt);
    f.roll *= Math.exp(-6 * dt);
  } else {
    f.pitch = clamp(f.pitch + input.pitch * 0.45 * dt, -0.4, 0.4);
    if (Math.abs(input.roll) > 0.05) f.roll = clamp(f.roll + input.roll * 0.9 * dt, -0.8, 0.8);
    else f.roll *= Math.exp(-0.8 * dt);
    f.yaw -= Math.sin(f.roll) * 0.42 * dt * (60 / Math.max(f.speed, 60)) * 1.6;
  }

  const lift = clamp((f.speed - stall * 0.75) / (stall * 0.25), 0, 1);
  let vy = f.speed * Math.sin(f.pitch) * lift - (1 - lift) * 14;
  if (f.onGround && vy <= 0) vy = 0;
  f.vy = vy;

  const horiz = f.speed * Math.cos(f.pitch);
  f.x += -Math.sin(f.yaw) * horiz * dt;
  f.z += -Math.cos(f.yaw) * horiz * dt;
  f.y += vy * dt;

  if (f.onGround && f.y > 0.5) {
    f.onGround = false;
  }
  if (!f.airborne && f.y > 8) {
    f.airborne = true;
    ev = { t: "takeoff" };
  }
  if (!f.onGround && f.y <= 0) {
    const vs = f.vy;
    f.y = 0;
    f.onGround = true;
    if (f.airborne) {
      let reason = "";
      if (!f.gear) reason = "Belly landing — the landing gear was up.";
      else if (vs < -opts.maxVs) reason = `Hard impact at ${Math.round(-vs * 196.85)} fpm.`;
      else if (!onDestRunway(f.x, f.z, opts.distance)) reason = "Touched down off the destination runway.";
      const ok = reason === "";
      if (!ok) {
        f.crashed = true;
        f.speed = 0;
        f.throttle = 0;
      }
      ev = { t: "touchdown", vs, ok, reason };
    }
    f.vy = 0;
    f.pitch = Math.max(0, f.pitch);
  }
  if (f.onGround) f.roll *= Math.exp(-6 * dt);
  return ev;
}
