// @ts-nocheck -- strict index checks relaxed for game math
export const SEAT_X = [-1.05, -0.55, 0.55, 1.05];
export const Z0 = 2.8;
export const PITCH = 0.95;
export const DOOR = { x: -1.05, z: 1.2 };

export function layout(rows: number) {
  const zEnd = Z0 + rows * PITCH;
  return { zEnd, L: zEnd + 3.2, galleyZ: zEnd + 1.6 };
}

export function seatPos(seat: number) {
  const row = Math.floor(seat / 4);
  return { x: SEAT_X[seat % 4], z: Z0 + row * PITCH };
}

/** Walk from the door, down the aisle and into the seat. */
export function boardingPos(seat: number, p: number) {
  const s = seatPos(seat);
  const pts = [
    { x: DOOR.x, z: DOOR.z },
    { x: 0, z: 1.8 },
    { x: 0, z: s.z + 0.1 },
    { x: s.x, z: s.z + 0.1 },
  ];
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    seg.push(d);
    total += d;
  }
  let d = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, d / seg[i]) : 1;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ry: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
    }
    d -= seg[i];
  }
  return { x: s.x, z: s.z, ry: 0 };
}

export function clampWalk(x: number, z: number, rows: number) {
  const { zEnd, L } = layout(rows);
  z = Math.max(0.4, Math.min(L - 0.4, z));
  const inRows = z > Z0 - 0.45 && z < zEnd - 0.2;
  const half = inRows ? 0.28 : 1.15;
  x = Math.max(-half, Math.min(half, x));
  return { x, z };
}
