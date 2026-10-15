export const keys = new Set<string>();

export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}

export function bindKeys() {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

/** Optional controller: left stick = roll/pitch, triggers = throttle. */
export function gamepadAxes() {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && Array.from(pads).find((p) => p);
  if (!gp) return null;
  const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
  return {
    roll: dz(gp.axes[0] ?? 0),
    pitch: dz(gp.axes[1] ?? 0),
    thr: (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0),
    lx: dz(gp.axes[0] ?? 0),
    ly: dz(gp.axes[1] ?? 0),
  };
}
