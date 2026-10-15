import { describe, expect, it } from "vitest";
import { applyAction, hostTick, newFlight } from "./logic";
import { passengerPosition, rescueTarget } from "./rescue";
import { stepHazards } from "./hazards";
import { flight } from "./flight";

function flying() {
  const s = newFlight(null, "crew", "hopper", "normal");
  s.roles.crew = "pilot";
  s.phase = "flying";
  s.passengers.forEach(p => { p.progress = 1; });
  return s;
}

describe("Passenger rescue", () => {
  it("replaces requests with escape attempts", () => {
    const s = flying();
    for (let i = 0; i < 49; i++) hostTick(s, 0.25);
    expect(s.passengers.some(p => p.escape !== null)).toBe(true);
    expect(s.passengers.every(p => p.need === null)).toBe(true);
  });
  it("requires sustained holds, awards rescue once and returns to seat", () => {
    const s = flying(); const p = s.passengers[0];
    if (!p) throw Error("No passenger");
    p.escape = 0.5;
    for (let i = 0; i < 6; i++) { applyAction(s, { t: "holdPassenger", pid: p.id, from: "crew" }); hostTick(s, 0.25); }
    expect(p.escape).toBe(null); expect(p.rescued).toBe(1); expect(s.tips).toBe(50);
    applyAction(s, { t: "holdPassenger", pid: p.id, from: "crew" }); hostTick(s, 0.25);
    expect(s.tips).toBe(50);
  });
  it("expires holds and lets an unrescued passenger jump", () => {
    const s = flying(); const p = s.passengers[0];
    if (!p) throw Error("No passenger");
    p.escape = 1.19;
    hostTick(s, 0.25);
    expect(p.lost).toBe(true);
  });
  it("targets moving passengers only within reach", () => {
    const s = flying(); const p = s.passengers[0];
    if (!p) throw Error("No passenger");
    p.escape = 0.6;
    const pos = passengerPosition(p);
    expect(rescueTarget(s.passengers, pos.x, pos.z)?.id).toBe(p.id);
    expect(rescueTarget(s.passengers, 100, 100)).toBe(null);
  });
});

describe("Flight hazards", () => {
  it("damages the plane and disables autopilot on impact", () => {
    const s = flying();
    const f = { ...flight, x: 0, y: 500, z: 0, onGround: false, crashed: false, speed: 100, ap: true };
    s.hazards = [{ id: 1, kind: "meteor", x: 0, y: 500, z: 0, vx: 0, vy: 0, vz: 0, age: 0 }];
    stepHazards(s, f, 0.05);
    expect(s.hull).toBe(75); expect(f.ap).toBe(false); expect(s.hazards.length).toBe(0);
  });
  it("lets a dodged meteor pass without damage", () => {
    const s = flying(); const f = { ...flight, y: 500, onGround: false, crashed: false };
    s.hazards = [{ id: 1, kind: "meteor", x: 5000, y: 500, z: 0, vx: 0, vy: -50, vz: 0, age: 0 }];
    stepHazards(s, f, 0.05); expect(s.hull).toBe(100);
  });
});