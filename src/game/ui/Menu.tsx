import { useEffect, useState } from "react";
import { AIRCRAFT, ROUTES, routeDetails, type AircraftId } from "../aircraft";
import { sfx } from "../audio";
import { startSession } from "../controller";
import { loadProfile, loadSettings, useGame, type Difficulty } from "../store";

type Tab = "home" | "join" | "hangar" | "settings" | "controls";

export function Menu() {
  const [tab, setTab] = useState<Tab>("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const selectedRoute = useGame((s) => s.selectedRoute);

  useEffect(() => {
    const st = useGame.getState();
    st.set({ profile: loadProfile(), settings: loadSettings() });
    setName(localStorage.getItem("skycrew-name") || `Crew${Math.floor(Math.random() * 900 + 100)}`);
    const room = new URL(window.location.href).searchParams.get("room");
    if (room) {
      setCode(room.toUpperCase());
      setTab("join");
    }
  }, []);

  const go = (room: string | null) => {
    const n = name.trim() || "Crew";
    localStorage.setItem("skycrew-name", n);
    sfx.init();
    sfx.setVolume(useGame.getState().settings.volume);
    if (room) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", room);
      window.history.replaceState(null, "", url);
    }
    useGame.getState().set({ view: "outside", cam: "chase" });
    startSession(room, n);
  };

  const newCode = () => Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-menu-sky" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="relative flex h-full flex-col justify-center px-10 md:px-20">
        <div className="text-xs font-bold uppercase tracking-[0.35em] text-signal">Co-op airline simulator</div>
        <h1 className="mt-2 font-display text-6xl font-extrabold leading-none tracking-tight md:text-7xl">
          SkyCrew
          <span className="block text-3xl font-semibold text-muted-foreground md:text-4xl">Airlines Together</span>
        </h1>

        <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card/85 p-6 shadow-hud backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-display text-lg font-bold">${profile.money.toLocaleString()} · {profile.xp} XP</span>
          </div>

          {tab === "home" && (
            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Your name
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} className="menu-input mt-1" />
              </label>
              <label className="block text-xs uppercase text-muted-foreground">Route
                <select aria-label="Route" value={selectedRoute} onChange={(e) => useGame.getState().set({ selectedRoute: Number(e.target.value) })} className="menu-input mt-1">
                  {ROUTES.map((r, i) => <option key={i} value={i}>{r[1]} → {r[3]} · {routeDetails(i).distance / 1000} km · {routeDetails(i).label}</option>)}
                </select>
              </label>
              <button className="menu-btn w-full" onClick={() => go(null)}>Play solo</button>
              <div className="grid grid-cols-2 gap-3">
                <button className="menu-btn-alt" onClick={() => go(newCode())}>Host online</button>
                <button className="menu-btn-alt" onClick={() => setTab("join")}>Join friend</button>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button className="menu-link" onClick={() => setTab("hangar")}>Hangar</button>
                <button className="menu-link" onClick={() => setTab("settings")}>Settings</button>
                <button className="menu-link" onClick={() => setTab("controls")}>Controls</button>
              </div>
            </div>
          )}

          {tab === "join" && (
            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Your name
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} className="menu-input mt-1" />
              </label>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">
                Room code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="e.g. K7QXP"
                  className="menu-input mt-1 font-mono tracking-[0.3em]"
                />
              </label>
              <button className="menu-btn w-full" disabled={code.length < 4} onClick={() => go(code)}>Join flight</button>
              <button className="menu-link w-full" onClick={() => setTab("home")}>← Back</button>
            </div>
          )}

          {tab === "hangar" && <Hangar onBack={() => setTab("home")} />}

          {tab === "settings" && (
            <div className="space-y-4 text-sm">
              <label className="block">
                Master volume
                <input
                  type="range" min={0} max={1} step={0.05} value={settings.volume}
                  onChange={(e) => { const v = Number(e.target.value); useGame.getState().saveSettings({ ...settings, volume: v }); sfx.setVolume(v); }}
                  className="mt-1 w-full accent-[var(--signal)]"
                />
              </label>
              <label className="flex items-center justify-between">
                Invert pitch (↑ = nose up)
                <input type="checkbox" checked={settings.invertPitch} onChange={(e) => useGame.getState().saveSettings({ ...settings, invertPitch: e.target.checked })} />
              </label>
              <div>
                Landing difficulty (when you host)
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["easy", "normal", "realistic"] as Difficulty[]).map((d) => (
                    <button key={d} className={settings.difficulty === d ? "menu-btn py-1.5 text-sm" : "menu-btn-alt py-1.5 text-sm"} onClick={() => useGame.getState().saveSettings({ ...settings, difficulty: d })}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <button className="menu-link w-full" onClick={() => setTab("home")}>← Back</button>
            </div>
          )}

          {tab === "controls" && (
            <div className="space-y-2 text-sm">
              <p><b>Both pilots:</b> W/S throttle · ↓/↑ pitch · ←/→ bank · G gear · F flaps · Z autopilot · B seatbelt sign · Space brakes · C camera.</p>
              <p><b>Cabin crew:</b> V go to cabin · W/S walk · A/D turn · mouse look (click cabin) · hold E to pull passengers away from the exit · E close door.</p>
              <p><b>Flight:</b> board everyone, close the door, seatbelt sign on, take off, rescue passengers and dodge meteors / wind shear, then land gently on the destination runway and brake to a stop.</p>
              <p className="text-muted-foreground">Gamepad supported: left stick + triggers.</p>
              <button className="menu-link w-full" onClick={() => setTab("home")}>← Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Hangar({ onBack }: { onBack: () => void }) {
  const profile = useGame((s) => s.profile);
  const save = useGame((s) => s.saveProfile);
  return (
    <div className="space-y-2">
      {(Object.keys(AIRCRAFT) as AircraftId[]).map((id) => {
        const a = AIRCRAFT[id];
        const owned = profile.owned.includes(id);
        const selected = profile.selected === id;
        return (
          <div key={id} className={`rounded-xl border p-3 ${selected ? "border-signal" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-bold">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.tagline} · {a.rows * 3} pax · pay ×{a.pay}</div>
              </div>
              {owned ? (
                <button className={selected ? "menu-btn px-3 py-1 text-sm" : "menu-btn-alt px-3 py-1 text-sm"} onClick={() => save({ ...profile, selected: id })}>
                  {selected ? "Selected" : "Fly"}
                </button>
              ) : (
                <button
                  className="menu-btn-alt px-3 py-1 text-sm"
                  disabled={profile.money < a.price}
                  onClick={() => save({ ...profile, money: profile.money - a.price, owned: [...profile.owned, id], selected: id })}
                >
                  ${a.price.toLocaleString()}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">When you host, your selected aircraft is used for the flight.</p>
      <button className="menu-link w-full" onClick={onBack}>← Back</button>
    </div>
  );
}
