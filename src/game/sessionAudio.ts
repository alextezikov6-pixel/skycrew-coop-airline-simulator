import { sfx } from "./audio";

export function audioUpdate(throttle: number, speed: number, inCabin: boolean) {
  sfx.update(throttle, speed, inCabin);
}
