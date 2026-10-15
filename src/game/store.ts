import { create } from "zustand";
import type { AircraftId } from "./aircraft";

export type Role = "pilot" | "attendant";
export type Need = "drink" | "meal" | "blanket";
export type Phase = "boarding" | "ready" | "flying" | "landed" | "results";
export type Weather = "clear" | "cloudy" | "storm";
export type Difficulty = "easy" | "normal" | "realistic";

export interface Passenger {
  id: number;
  name: string;
  seat: number;
  color: string;
  skin: string;
  hair: string;
  progress: number; // <0 waiting at gate, 0..1 walking, 1 seated
  need: Need | null;
  waiting: number;
  mood: number;
  escape: number | null;
  rescued: number;
  lost: boolean;
  hold: number;
  heldBy: string | null;
  heldUntil: number;
}

export interface Hazard {
  id: number;
  kind: "meteor" | "wind";
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number;
}

export interface FlightResult {
  safety: number;
  punctuality: number;
  satisfaction: number;
  money: number;
  xp: number;
  crashed: boolean;
  note: string;
}

export interface Shared {
  rev: number;
  flightId: number;
  hostId: string;
  phase: Phase;
  aircraft: AircraftId;
  routeIdx: number;
  roles: Record<string, Role>;
  names: Record<string, string>;
  passengers: Passenger[];
  doorClosed: boolean;
  seatbelt: boolean;
  turbulence: number;
  weather: Weather;
  timeOfDay: number;
  flightTime: number;
  tips: number;
  difficulty: Difficulty;
  landingVs: number | null;
  result: FlightResult | null;
  log: { n: number; text: string }[];
  logN: number;
  hull: number;
  hazards: Hazard[];
  hazardClock: number;
  hazardN: number;
  rescueClock: number;
}

export interface Profile {
  money: number;
  xp: number;
  owned: AircraftId[];
  selected: AircraftId;
  paid: string[];
}

export interface Settings {
  volume: number;
  invertPitch: boolean;
  difficulty: Difficulty;
}

export interface Hud {
  kt: number;
  ft: number;
  fpm: number;
  hdg: number;
  thr: number;
  gear: boolean;
  flaps: boolean;
  ap: boolean;
  brake: boolean;
  onGround: boolean;
  distKm: number;
  glideFt: number;
}

export interface ChatMsg {
  id: string;
  from: string;
  text: string;
}

const PROFILE_KEY = "skycrew-profile";
const SETTINGS_KEY = "skycrew-settings";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultProfile();
}
function defaultProfile(): Profile {
  return { money: 500, xp: 0, owned: ["hopper"], selected: "hopper", paid: [] };
}
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { volume: 0.6, invertPitch: false, difficulty: "normal", ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { volume: 0.6, invertPitch: false, difficulty: "normal" };
}

interface GameState {
  screen: "menu" | "game";
  name: string;
  room: string | null; // null = solo/offline
  myId: string;
  netStatus: string;
  view: "outside" | "cabin";
  cam: "chase" | "cockpit";
  carry: Need | null;
  prompt: string | null;
  chat: ChatMsg[];
  roster: { id: string; name: string }[];
  shared: Shared | null;
  hud: Hud;
  profile: Profile;
  settings: Settings;
  showHelp: boolean;
  selectedRoute: number;
  set: (p: Partial<GameState>) => void;
  saveProfile: (p: Profile) => void;
  saveSettings: (s: Settings) => void;
}

export const useGame = create<GameState>((set) => ({
  screen: "menu",
  name: "",
  room: null,
  myId: "",
  netStatus: "offline",
  view: "outside",
  cam: "chase",
  carry: null,
  prompt: null,
  chat: [],
  roster: [],
  shared: null,
  hud: {
    kt: 0, ft: 0, fpm: 0, hdg: 0, thr: 0, gear: true, flaps: true, ap: false,
    brake: true, onGround: true, distKm: 24, glideFt: 0,
  },
  profile: defaultProfile(),
  settings: { volume: 0.6, invertPitch: false, difficulty: "normal" },
  showHelp: false,
  selectedRoute: 0,
  set: (p) => set(p),
  saveProfile: (p) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    set({ profile: p });
  },
  saveSettings: (s) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    set({ settings: s });
  },
}));

export function myRole(): Role | undefined {
  const s = useGame.getState();
  return s.shared?.roles[s.myId];
}
