import { boardingPos, DOOR } from "./cabinLayout";
import type { Passenger } from "./store";

export const HOLD_SECONDS = 1.5;
export const ESCAPE_SECONDS = 18;

export function passengerPosition(p: Passenger) {
  if (p.escape === null || p.escape === undefined) return boardingPos(p.seat, 1);
  if (p.escape < 0.8) return boardingPos(p.seat, Math.max(0, 1 - p.escape / 0.8));
  return { x: DOOR.x - (p.escape - 0.8) * 1.8, z: DOOR.z, ry: Math.PI / 2 };
}

export function rescueTarget(passengers: Passenger[], x: number, z: number) {
  let best: Passenger | null = null;
  let distance = 1.55;
  for (const p of passengers) {
    if (p.lost || p.escape === null || p.escape === undefined) continue;
    const pos = passengerPosition(p);
    const d = Math.hypot(x - pos.x, z - pos.z);
    if (d < distance) { best = p; distance = d; }
  }
  return best;
}