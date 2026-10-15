import type { FlightInput } from "./flight";

export interface CrewInput extends FlightInput { brake: boolean }
export const neutralInput = (): CrewInput => ({ thr: 0, pitch: 0, roll: 0, brake: false });
const inputs = new Map<string, { input: CrewInput; at: number }>();

export function recordCrewInput(id: string, input: CrewInput, now = Date.now()) {
  if (![input.thr, input.pitch, input.roll].every(Number.isFinite)) return;
  inputs.set(id, { input, at: now });
}
export function clearCrewInputs() { inputs.clear(); }
export function combinedCrewInput(local: CrewInput, roster: string[], now = Date.now()): CrewInput {
  const result = { ...local };
  for (const [id, entry] of inputs) {
    if (!roster.includes(id) || now - entry.at > 1200) { inputs.delete(id); continue; }
    result.thr += entry.input.thr;
    result.pitch += entry.input.pitch;
    result.roll += entry.input.roll;
    result.brake ||= entry.input.brake;
  }
  for (const key of ["thr", "pitch", "roll"] as const) result[key] = Math.max(-1, Math.min(1, result[key]));
  return result;
}