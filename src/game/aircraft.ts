export type AircraftId = "hopper" | "jet" | "heavy";

export interface AircraftDef {
  id: AircraftId;
  name: string;
  tagline: string;
  price: number;
  rows: number; // 2-2 seating rows in cabin
  accel: number; // max thrust accel m/s²
  cruise: number; // m/s
  rotate: number; // rotation / stall speed m/s
  scale: number;
  pay: number; // payout multiplier
  livery: string;
  engines: "prop" | "jet";
}

export const AIRCRAFT: Record<AircraftId, AircraftDef> = {
  hopper: {
    id: "hopper",
    name: "SkyHopper Q200",
    tagline: "Twin-prop regional. Forgiving and slow.",
    price: 0,
    rows: 4,
    accel: 9,
    cruise: 150,
    rotate: 52,
    scale: 0.85,
    pay: 1,
    livery: "#e2622f",
    engines: "prop",
  },
  jet: {
    id: "jet",
    name: "SkyCrew A220",
    tagline: "Narrow-body jet. Faster, more passengers.",
    price: 4000,
    rows: 6,
    accel: 12,
    cruise: 200,
    rotate: 64,
    scale: 1,
    pay: 1.7,
    livery: "#2a7fb8",
    engines: "jet",
  },
  heavy: {
    id: "heavy",
    name: "Meridian W787",
    tagline: "Long-haul liner. Heavy, fast, lucrative.",
    price: 12000,
    rows: 8,
    accel: 13,
    cruise: 235,
    rotate: 74,
    scale: 1.3,
    pay: 2.6,
    livery: "#1f9e7a",
    engines: "jet",
  },
};

/** Destination runway centre is at z = -DEST. Departure runway centre at z = 0. */
export const DEST = 24000;
export const CRUISE_ALT = 900;
export const GLIDE = 0.075; // altitude per metre of distance on approach
export const RUNWAY_LEN = 1600;
export const RUNWAY_W = 45;

export const ROUTES: [string, string, string, string][] = [
  ["Harborview", "HBV", "Alpine Ridge", "ALR"],
  ["Alpine Ridge", "ALR", "Coral Bay", "CRB"],
  ["Coral Bay", "CRB", "Northgate", "NGT"],
  ["Northgate", "NGT", "Harborview", "HBV"],
  ["Harborview", "HBV", "Coral Bay", "CRB"],
  ["Northgate", "NGT", "Alpine Ridge", "ALR"],
];

export const ROUTE_DETAILS = [
  { distance: 24000, altitude: 900, terrain: "alpine", label: "Mountain passage", weather: "clear", time: 16.5 },
  { distance: 32000, altitude: 1200, terrain: "coast", label: "Ridge to coast", weather: "cloudy", time: 11 },
  { distance: 18000, altitude: 650, terrain: "islands", label: "Island hop", weather: "clear", time: 13.5 },
  { distance: 40000, altitude: 1400, terrain: "forest", label: "Northern crossing", weather: "storm", time: 16 },
  { distance: 22000, altitude: 800, terrain: "coast", label: "Sunset coastline", weather: "clear", time: 18.3 },
  { distance: 28000, altitude: 1100, terrain: "alpine", label: "Alpine approach", weather: "cloudy", time: 8 },
] as const;
export function routeDetails(index: number) { return ROUTE_DETAILS[index] ?? ROUTE_DETAILS[0]; }
