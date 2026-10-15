import { describe, expect, it } from "vitest";
import { clearCrewInputs, combinedCrewInput, neutralInput, recordCrewInput } from "./flightControls";

describe("crew flight input", () => {
  it.each([2, 3, 4, 5])("combines input from a %i-player crew", (playerCount) => {
    clearCrewInputs();
    const remoteCrew = Array.from({ length: playerCount - 1 }, (_, index) => `crew-${index}`);

    remoteCrew.forEach((id) => {
      recordCrewInput(id, { thr: 0.5, pitch: 0.25, roll: -0.5, brake: true }, 1000);
    });

    expect(combinedCrewInput(neutralInput(), remoteCrew, 1100)).toEqual({
      thr: Math.min(1, 0.5 * remoteCrew.length),
      pitch: Math.min(1, 0.25 * remoteCrew.length),
      roll: Math.max(-1, -0.5 * remoteCrew.length),
      brake: remoteCrew.length > 0,
    });
    clearCrewInputs();
  });
});
