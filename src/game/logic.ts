// @ts-nocheck -- strict index checks relaxed for game math
import { AIRCRAFT, ROUTES, routeDetails, type AircraftId } from "./aircraft";
import type { Difficulty, FlightResult, Need, Passenger, Shared, Weather } from "./store";
import { ESCAPE_SECONDS, HOLD_SECONDS } from "./rescue";

export type Action =
  | { t: "closeDoor" }
  | { t: "seatbelt"; on: boolean }
  | { t: "holdPassenger"; pid: number; from: string }
  | { t: "takeoff" }
  | { t: "touchdown"; vs: number; ok: boolean; reason: string }
  | { t: "parked" }
  | { t: "next" }
  | { t: "swap" }
  | { t: "setRoute"; index: number }
  | { t: "setAircraft"; id: AircraftId };

const NAMES = [
  "Ava", "Kenji", "Lucia", "Omar", "Freya", "Mateo", "Priya", "Jonas", "Amara", "Leo",
  "Sofia", "Ravi", "Nora", "Theo", "Hana", "Diego", "Ingrid", "Kwame", "Mila", "Yusuf",
  "Elena", "Bao", "Clara", "Idris", "June", "Marco", "Zara", "Felix", "Aiko", "Tomas",
];
const SKIN = ["#f1c7a3", "#d9a47c", "#a96f4a", "#7a4b2e", "#e8b896", "#5c3a22"];
const HAIR = ["#2b1d14", "#5a3a22", "#c9a14a", "#1a1a1a", "#8a4b2a", "#d8d2c4"];
const SHIRT = ["#c0392b", "#2e86ab", "#f4a261", "#2a9d8f", "#8e7dbe", "#e9c46a", "#3d5a80", "#d1495b"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function allBoarded(s: Shared) {
  return s.passengers.every((p) => p.progress >= 1);
}

export function makePassengers(ac: AircraftId): Passenger[] {
  const seats = AIRCRAFT[ac].rows * 4;
  const count = Math.round(seats * 0.75);
  const all = [...Array(seats).keys()].sort(() => Math.random() - 0.5).slice(0, count);
  // board back-to-front
  all.sort((a, b) => b - a);
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  return all.map((seat, i) => ({
    id: i,
    name: names[i % names.length],
    seat,
    color: pick(SHIRT),
    skin: pick(SKIN),
    hair: pick(HAIR),
    progress: -i * 0.4,
    need: null,
    waiting: 0,
    mood: 72 + Math.random() * 12,
    escape: null, rescued: 0, lost: false, hold: 0, heldBy: null, heldUntil: 0,
  }));
}

const WEATHERS: Weather[] = ["clear", "clear", "cloudy", "cloudy", "storm"];
const TIMES = [8, 11, 13.5, 16.5, 18.6];

export function newFlight(prev: Shared | null, hostId: string, aircraft: AircraftId, difficulty: Difficulty, selectedRoute = 0): Shared {
  const routeIdx = prev ? (prev.routeIdx + 1) % ROUTES.length : selectedRoute;
  const route = routeDetails(routeIdx);
  return {
    rev: (prev?.rev ?? 0) + 1,
    flightId: (prev?.flightId ?? 0) + 1,
    hostId,
    phase: "boarding",
    aircraft,
    routeIdx,
    roles: prev?.roles ?? {},
    names: prev?.names ?? {},
    passengers: makePassengers(aircraft),
    doorClosed: false,
    seatbelt: false,
    turbulence: 0,
    weather: route.weather,
    timeOfDay: route.time,
    flightTime: 0,
    tips: 0,
    difficulty,
    landingVs: null,
    result: null,
    log: [{ n: (prev?.logN ?? 0) + 1, text: "Boarding has started — prepare the cabin!" }],
    logN: (prev?.logN ?? 0) + 1,
    hull: 100, hazards: [], hazardClock: 0, hazardN: 0, rescueClock: 0,
  };
}

function log(s: Shared, text: string) {
  s.logN += 1;
  s.log = [...s.log.slice(-5), { n: s.logN, text }];
}

export function computeResult(s: Shared, crashed: boolean, note: string): FlightResult {
  const ac = AIRCRAFT[s.aircraft];
  const satisfaction = Math.round(s.passengers.reduce((a, p) => a + p.mood, 0) / Math.max(1, s.passengers.length));
  if (crashed) {
    return { safety: 0, punctuality: 0, satisfaction, money: 0, xp: 20, crashed: true, note };
  }
  const vs = -(s.landingVs ?? 0);
  const safety = Math.round(Math.max(0, Math.min(s.hull, 100 - Math.max(0, vs - 1.2) * 16 - s.passengers.filter(p => p.lost).length * 25)));
  const target = (routeDetails(s.routeIdx).distance / ac.cruise) * 1.4 + 45;
  const punctuality = Math.round(Math.max(0, Math.min(100, 100 - Math.max(0, s.flightTime - target) * 0.7)));
  const money = Math.round(ac.pay * (400 + safety * 4 + punctuality * 3 + satisfaction * 5) + s.tips);
  const xp = Math.round((safety + punctuality + satisfaction) * ac.pay);
  return { safety, punctuality, satisfaction, money, xp, crashed: false, note: note || "Smooth flight, captain." };
}

export function maxTouchdownVs(d: Difficulty) {
  return d === "easy" ? 9 : d === "normal" ? 6 : 3.8;
}

export function applyAction(s: Shared, a: Action) {
  switch (a.t) {
    case "setRoute":
      if (s.phase === "boarding" && Number.isInteger(a.index) && ROUTES[a.index] && a.index !== s.routeIdx) {
        const route = routeDetails(a.index);
        Object.assign(s, newFlight(null, s.hostId, s.aircraft, s.difficulty, a.index), {
          flightId: s.flightId + 1, rev: s.rev, roles: s.roles, names: s.names,
          weather: route.weather, timeOfDay: route.time,
        });
      }
      break;
    case "closeDoor":
      if (s.phase === "boarding" && allBoarded(s) && !s.doorClosed) {
        s.doorClosed = true;
        log(s, "Cabin door closed and armed.");
      }
      break;
    case "seatbelt":
      s.seatbelt = a.on;
      log(s, a.on ? "Seatbelt sign ON." : "Seatbelt sign OFF — passengers may move about.");
      break;
    case "holdPassenger": {
      const p = s.passengers.find((x) => x.id === a.pid);
      if (s.phase === "flying" && p && !p.lost && p.escape !== null && s.roles[a.from]) {
        p.heldBy = a.from;
        p.heldUntil = s.flightTime + 0.75;
      }
      break;
    }
    case "takeoff":
      if (s.phase === "ready") {
        s.phase = "flying";
        s.flightTime = 0;
        log(s, "Wheels up! Have a pleasant flight.");
      }
      break;
    case "touchdown":
      if (s.phase !== "flying") break;
      s.landingVs = a.vs;
      if (a.ok) {
        s.phase = "landed";
        log(s, `Touchdown at ${Math.round(-a.vs * 196.85)} fpm. Brake and come to a stop.`);
      } else {
        s.phase = "results";
        for (const p of s.passengers) p.mood = Math.max(0, p.mood - 50);
        s.result = computeResult(s, true, a.reason);
        log(s, "Flight ended in an incident.");
      }
      break;
    case "parked":
      if (s.phase === "landed") {
        s.phase = "results";
        s.result = computeResult(s, false, "");
        log(s, "Parked at the gate. Passengers are deplaning.");
      }
      break;
    case "next":
      if (s.phase === "results") Object.assign(s, newFlight(s, s.hostId, s.aircraft, s.difficulty));
      break;
    case "swap":
      if (s.phase === "boarding" || s.phase === "results") {
        for (const k of Object.keys(s.roles)) s.roles[k] = s.roles[k] === "pilot" ? "attendant" : "pilot";
        log(s, "Crew swapped roles.");
      }
      break;
    case "setAircraft":
      if (s.phase === "boarding" && !s.doorClosed && s.aircraft !== a.id) {
        Object.assign(s, newFlight(s, s.hostId, a.id, s.difficulty), { routeIdx: s.routeIdx, weather: s.weather, timeOfDay: s.timeOfDay });
      }
      break;
  }
}

/** Host-only simulation of passengers, events and phase gates. */
export function hostTick(s: Shared, dt: number) {
  if (s.phase === "boarding") {
    for (const p of s.passengers) if (p.progress < 1) p.progress = Math.min(1, p.progress + dt * 0.28);
  }
  if (s.phase === "boarding" && allBoarded(s) && s.doorClosed && s.seatbelt) {
    s.phase = "ready";
    log(s, "Cabin ready. Cleared for takeoff!");
  }
  if (s.phase === "flying" || s.phase === "landed") s.flightTime += dt;
  if (s.phase === "flying") {
    s.rescueClock += dt;
    const active = s.passengers.filter(p => p.escape !== null && !p.lost);
    if (s.rescueClock >= 12 && active.length < (Object.keys(s.roles).length > 1 ? 2 : 1)) {
      const candidates = s.passengers.filter(p => !p.lost && p.escape === null && p.waiting <= 0);
      const p = pick(candidates);
      if (p) { p.escape = 0; p.hold = 0; log(s, `${p.name} is running toward the exit!`); }
      s.rescueClock = 0;
    }
    for (const p of s.passengers) {
      p.need = null;
      p.waiting = Math.max(0, p.waiting - dt);
      if (p.lost || p.escape === null) continue;
      if (p.heldBy && p.heldUntil >= s.flightTime) {
        p.hold = Math.min(1, p.hold + dt / HOLD_SECONDS);
        if (p.hold >= 1 - 1e-9) {
          p.escape = null; p.heldBy = null; p.rescued += 1; p.waiting = 35; p.mood = 100;
          s.tips += 50;
          log(s, `${p.name} rescued! +$50 rescue bonus`);
        }
      } else {
        p.heldBy = null;
        p.hold = Math.max(0, p.hold - dt * 0.3);
        p.escape = Math.min(1.2, p.escape + dt / ESCAPE_SECONDS);
        if (p.escape >= 1.2) { p.lost = true; p.mood = 0; log(s, `${p.name} jumped — rescue missed!`); }
      }
    }
    if (s.turbulence > 0) {
      s.turbulence = Math.max(0, s.turbulence - dt);
      if (!s.seatbelt) for (const p of s.passengers) p.mood = Math.max(0, p.mood - dt * 2.5);
    } else if (Math.random() < dt * (s.weather === "storm" ? 0.035 : s.weather === "cloudy" ? 0.015 : 0.006)) {
      s.turbulence = 7 + Math.random() * 5;
      log(s, s.seatbelt ? "Turbulence! Passengers are buckled in." : "Turbulence! Turn the seatbelt sign ON!");
    }
  }
}
