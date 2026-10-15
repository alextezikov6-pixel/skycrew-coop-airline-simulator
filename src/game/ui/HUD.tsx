// @ts-nocheck -- strict index checks relaxed for game math
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { keys } from "../input";
import { me } from "../controller";
import { rescueTarget } from "../rescue";
import { AIRCRAFT, ROUTES, routeDetails } from "../aircraft";
import { sfx } from "../audio";
import { dispatch, sendChat, stopSession } from "../controller";
import { useGame } from "../store";

export function HUD() {
  const shared = useGame((s) => s.shared);
  const view = useGame((s) => s.view);
  const room = useGame((s) => s.room);
  const myId = useGame((s) => s.myId);
  const showHelp = useGame((s) => s.showHelp);
  if (!shared) {
    return (
      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
        <div className="rounded-xl bg-hud/90 px-6 py-4 font-display text-hud-foreground">
          {room ? `Connecting to room ${room}…` : "Preparing aircraft…"}
        </div>
      </div>
    );
  }
  const role = shared.roles[myId];
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-body text-hud-foreground">
      <TopLeft />
      <TopRight />
      <LogFeed />
      <Prompt />
      {view === "outside" ? <Instruments /> : <CabinBar />}
      <HazardWarning />
      <Chat />
      {shared.phase === "results" && shared.result && <Results />}
      {showHelp && <Help role={role} />}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-hud-border bg-hud/80 p-3 shadow-hud backdrop-blur-md ${className}`}>{children}</div>;
}

function TopLeft() {
  const s = useGame((st) => st.shared)!;
  const myId = useGame((st) => st.myId);
  const hud = useGame((st) => st.hud);
  const role = s.roles[myId];
  const r = ROUTES[s.routeIdx];
  const ac = AIRCRAFT[s.aircraft];
  const boarded = s.passengers.filter((p) => p.progress >= 1).length;
  const requests = s.passengers.filter((p) => p.escape !== null && !p.lost).length;
  const vr = Math.round(ac.rotate * 0.82 * 1.944);
  type Task = { label: string; done: boolean; who?: string };
  const tasks: Task[] = [];
  if (s.phase === "boarding" || s.phase === "ready") {
    tasks.push({ label: `Board passengers (${boarded}/${s.passengers.length})`, done: boarded === s.passengers.length });
    tasks.push({ label: "Close & arm cabin door (E at door)", done: s.doorClosed, who: "Cabin" });
    tasks.push({ label: "Seatbelt sign ON (B)", done: s.seatbelt, who: "Pilot" });
    tasks.push({ label: `Take off — full throttle (W), rotate at ${vr} kt (↓)`, done: false, who: "Pilot" });
  } else if (s.phase === "flying") {
    tasks.push({ label: "Gear up (G) after takeoff", done: !hud.gear || hud.ft < 50, who: "Pilot" });
    tasks.push({ label: `Climb to ${Math.round(routeDetails(s.routeIdx).altitude * 3.281).toLocaleString()} ft, autopilot (Z)`, done: hud.ap || hud.ft > 2500, who: "Pilot" });
    tasks.push({ label: `Rescue passengers — ${requests} at risk`, done: requests === 0, who: "Cabin" });
    tasks.push({ label: "Seatbelt sign ON in turbulence", done: s.turbulence <= 0 || s.seatbelt, who: "Pilot" });
    tasks.push({ label: "Under 10 km: AP off, follow glidepath, gear + flaps", done: false, who: "Pilot" });
  } else if (s.phase === "landed") {
    tasks.push({ label: "Throttle idle (S), brake (Space) to a full stop", done: false, who: "Pilot" });
  }
  return (
    <Panel className="absolute left-4 top-4 w-72 max-w-[calc(50vw-1.5rem)]">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold tracking-tight">
          {r[1]} <span className="text-signal">→</span> {r[3]}
        </div>
        <span className="rounded-full bg-signal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-signal-foreground">{s.phase}</span>
      </div>
      <div className="text-xs text-hud-muted">
        {r[0]} to {r[2]} · {ac.name} · {s.weather} · {fmtTime(s.timeOfDay)}
      </div>
      <div className="mt-1 text-xs">
        You are the <b className="text-signal">{role === "pilot" ? "Captain" : "Co-pilot"}</b>
      </div>
      {s.phase === "boarding" && <select aria-label="Flight route" className="pointer-events-auto mt-2 w-full rounded border border-hud-border bg-hud-inset p-1 text-xs" value={s.routeIdx} onChange={(e) => dispatch({ t: "setRoute", index: Number(e.target.value) })}>
        {ROUTES.map((r, i) => <option key={i} value={i}>{r[1]} → {r[3]} · {routeDetails(i).distance / 1000} km</option>)}
      </select>}
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {tasks.map((t) => (
          <li key={t.label} className="flex items-start gap-2">
            <span className={`mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border ${t.done ? "border-ok bg-ok" : "border-hud-muted"}`} />
            <span className={t.done ? "text-hud-muted line-through" : ""}>{t.label}</span>
            {t.who && <span className="ml-auto text-[10px] uppercase text-hud-muted">{t.who}</span>}
          </li>
        ))}
      </ul>
      {s.turbulence > 0 && <div className="mt-2 animate-pulse rounded bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">TURBULENCE</div>}
      <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
        {(s.phase === "boarding" || s.phase === "results") && Object.keys(s.roles).length > 1 && (
          <Button variant="ghost" className="hud-btn" onClick={() => dispatch({ t: "swap" })}>Swap roles</Button>
        )}
        <Button variant="ghost" className="hud-btn" onClick={() => useGame.getState().set({ view: useGame.getState().view === "cabin" ? "outside" : "cabin" })}>
          {useGame.getState().view === "cabin" ? "Cockpit / outside (V)" : "Walk the cabin (V)"}
        </Button>
      </div>
    </Panel>
  );
}

function HazardWarning() {
  const s = useGame(st => st.shared);
  if (!s || s.phase !== "flying") return null;
  const threat = s.hazards[0];
  return <div className="absolute left-1/2 top-32 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-hud-border bg-hud/90 p-3 text-center">
    <div className={s.hull < 40 ? "text-destructive" : "text-ok"}>Aircraft integrity {s.hull}%</div>
    {threat && <div className="mt-1 animate-pulse font-bold text-signal">{threat.kind === "meteor" ? "☄ METEOR — EVADE" : "WIND SHEAR — EVADE"}</div>}
  </div>;
}

function fmtTime(t: number) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TopRight() {
  const s = useGame((st) => st.shared)!;
  const profile = useGame((st) => st.profile);
  const roster = useGame((st) => st.roster);
  const room = useGame((st) => st.room);
  const netStatus = useGame((st) => st.netStatus);
  const myId = useGame((st) => st.myId);
  const [copied, setCopied] = useState(false);
  const sat = Math.round(s.passengers.reduce((a, p) => a + p.mood, 0) / Math.max(1, s.passengers.length));
  return (
    <Panel className="pointer-events-auto absolute right-4 top-4 w-56 max-w-[calc(50vw-1.5rem)]">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-2xl font-bold">${profile.money.toLocaleString()}</div>
        <div className="text-xs text-hud-muted">{profile.xp} XP</div>
      </div>
      <div className="mt-1 text-xs text-hud-muted">Rescue bonuses: ${s.tips}</div>
      <div className="mt-2 text-xs">Passengers safe: {s.passengers.filter(p => !p.lost).length}/{s.passengers.length} · rescued {s.passengers.reduce((n, p) => n + p.rescued, 0)}</div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-hud-border">
        <div className={`h-full ${sat > 65 ? "bg-ok" : sat > 40 ? "bg-signal" : "bg-destructive"}`} style={{ width: `${sat}%` }} />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-hud-muted">Crew</div>
      <ul className="mt-1 space-y-1 text-sm">
        {(room ? roster : [{ id: myId, name: useGame.getState().name }]).map((r) => (
          <li key={r.id} className="flex justify-between">
            <span>{r.name}{r.id === myId ? " (you)" : ""}</span>
            <span className="text-xs text-signal">{s.roles[r.id] === "pilot" ? "Captain" : "Co-pilot"}</span>
          </li>
        ))}
      </ul>
      {room ? (
        <div className="mt-3 border-t border-hud-border pt-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Room <b className="font-mono text-sm tracking-widest">{room}</b></span>
            <span className={netStatus === "SUBSCRIBED" ? "text-ok" : "text-signal"}>{netStatus === "SUBSCRIBED" ? "online" : netStatus.toLowerCase()}</span>
          </div>
          <Button variant="ghost"
            className="hud-btn mt-2 w-full"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/?room=${room}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Invite link copied!" : "Copy invite link"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 border-t border-hud-border pt-2 text-xs text-hud-muted">Solo flight — you handle both cockpit and cabin.</div>
      )}
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" className="hud-btn flex-1" onClick={() => useGame.getState().set({ showHelp: !useGame.getState().showHelp })}>Controls (H)</Button>
        <Button variant="ghost"
          className="hud-btn flex-1"
          onClick={() => {
            stopSession();
            useGame.getState().set({ screen: "menu", shared: null });
          }}
        >
          Leave
        </Button>
      </div>
    </Panel>
  );
}

function LogFeed() {
  const log = useGame((s) => s.shared?.log ?? []);
  const last = useRef(0);
  useEffect(() => {
    const n = log[log.length - 1]?.n ?? 0;
    if (n > last.current && last.current !== 0) {
      const text = log[log.length - 1].text;
      if (text.includes("Seatbelt")) sfx.chime();
      else if (text.includes("Touchdown") || text.includes("Cleared")) sfx.success();
      else sfx.ding();
    }
    last.current = n;
  }, [log]);
  return (
    <div className="absolute left-1/2 top-[21rem] flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-1">
      {log.slice(-3).map((l, i, arr) => (
        <div key={l.n} className="rounded-full bg-hud/80 px-4 py-1 text-sm shadow-hud backdrop-blur" style={{ opacity: 0.45 + (i / Math.max(1, arr.length - 1)) * 0.55 }}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

function Prompt() {
  const prompt = useGame((s) => s.prompt);
  const view = useGame((s) => s.view);
  if (!prompt || view !== "cabin") return null;
  return (
    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 rounded-lg border border-signal bg-hud/90 px-4 py-2 font-display text-base font-semibold">
      {prompt}
    </div>
  );
}

function Instruments() {
  const h = useGame((s) => s.hud);
  const s = useGame((st) => st.shared)!;
  const myId = useGame((st) => st.myId);
  const pilot = true;
  const progress = Math.max(0, Math.min(1, 1 - h.distKm / (routeDetails(s.routeIdx).distance / 1000)));
  const glideDiff = h.ft - h.glideFt;
  const showGlide = h.distKm < 12 && !h.onGround;
  return (
    <div className="absolute bottom-4 left-1/2 w-[44rem] max-w-[calc(100vw-2rem)] -translate-x-1/2">
      <Panel>
        <div className="grid grid-cols-6 gap-2 text-center">
          <Gauge label="Speed" value={`${h.kt}`} unit="kt" />
          <Gauge label="Altitude" value={h.ft.toLocaleString()} unit="ft" />
          <Gauge label="Vert. speed" value={`${h.fpm > 0 ? "+" : ""}${h.fpm}`} unit="fpm" warn={h.fpm < -1100 && h.ft < 300} />
          <Gauge label="Heading" value={`${String(h.hdg).padStart(3, "0")}°`} unit="" />
          <Gauge label="Throttle" value={`${h.thr}`} unit="%" />
          <Gauge label="To dest." value={`${h.distKm}`} unit="km" />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold uppercase">
          <Pill on={h.gear} label="Gear (G)" />
          <Pill on={h.flaps} label="Flaps (F)" />
          <Pill on={h.ap} label="Autopilot (Z)" />
          <Pill on={s.seatbelt} label="Seatbelts (B)" />
          <Pill on={h.brake} label="Brakes (Space)" />
          {showGlide && (
            <span className={`rounded px-2 py-0.5 ${Math.abs(glideDiff) < 150 ? "bg-ok text-hud" : "bg-signal text-signal-foreground"}`}>
              Glidepath {Math.round(h.glideFt)} ft · {glideDiff > 150 ? "HIGH ↓" : glideDiff < -150 ? "LOW ↑" : "ON PATH"}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hud-border">
          <div className="h-full bg-signal" style={{ width: `${progress * 100}%` }} />
        </div>
        {!pilot && <div className="mt-1 text-center text-[11px] text-hud-muted">Your crewmate is flying. Press V to work the cabin.</div>}
        {pilot && s.phase === "boarding" && <div className="mt-1 text-center text-[11px] text-hud-muted">Engines locked until boarding is complete, the door is closed and seatbelt sign is on.</div>}
      </Panel>
    </div>
  );
}

function Gauge({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg bg-hud-inset px-2 py-1.5 ${warn ? "ring-2 ring-destructive" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-hud-muted">{label}</div>
      <div className="font-mono text-xl font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-[10px] text-hud-muted">{unit}</span>
      </div>
    </div>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return <span className={`rounded px-2 py-0.5 ${on ? "bg-ok text-hud" : "bg-hud-inset text-hud-muted"}`}>{label}</span>;
}

function CabinBar() {
  const s = useGame((st) => st.shared);
  if (!s) return null;
  const active = s.passengers.filter(p => p.escape !== null && !p.lost);
  const target = rescueTarget(s.passengers, me.x, me.z);
  return <div className="absolute bottom-4 left-1/2 w-[34rem] max-w-[calc(100vw-2rem)] -translate-x-1/2">
    <Panel className="text-sm">
      <div className="flex justify-between gap-3"><b className="text-signal">{active.length ? `${active.length} passengers at risk` : "Cabin secure"}</b><span>{s.passengers.filter(p => p.lost).length} lost</span></div>
      {active.map(p => <div key={p.id} className="mt-2 flex justify-between gap-2"><span>{p.name}</span><span className="text-signal">{Math.max(0, Math.ceil((1.2 - (p.escape ?? 0)) * 18))}s to jump · {Math.round(p.hold * 100)}% held</span></div>)}
      {target && <Button variant="destructive" className="pointer-events-auto mt-3 w-full" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); keys.add("KeyE"); }} onPointerUp={() => keys.delete("KeyE")} onPointerCancel={() => keys.delete("KeyE")}>Hold to rescue {target.name}</Button>}
    </Panel>
    <div className="fixed bottom-[45vh] left-1/2 h-1 w-1 rounded-full bg-hud-foreground" />
  </div>;
}

function Chat() {
  const chat = useGame((s) => s.chat);
  const room = useGame((s) => s.room);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && document.activeElement !== input.current) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!room) return null;
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 w-72">
      <Panel className="p-2">
        <div className="max-h-36 space-y-0.5 overflow-y-auto text-xs">
          {chat.length === 0 && <div className="text-hud-muted">Crew chat — press Enter to talk.</div>}
          {chat.map((m) => (
            <div key={m.id}>
              <b className="text-signal">{m.from}:</b> {m.text}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) sendChat(text.trim());
            setText("");
            input.current?.blur();
          }}
        >
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && input.current?.blur()}
            maxLength={200}
            placeholder="Message your crew…"
            className="mt-1 w-full rounded-md border border-hud-border bg-hud-inset px-2 py-1 text-xs outline-none focus:border-signal"
          />
        </form>
      </Panel>
    </div>
  );
}

function Results() {
  const s = useGame((st) => st.shared)!;
  const room = useGame((st) => st.room);
  const myId = useGame((st) => st.myId);
  const r = s.result!;
  useEffect(() => {
    const st = useGame.getState();
    const key = `${room ?? "solo"}:${s.hostId}:${s.flightId}`;
    if (st.profile.paid.includes(key)) return;
    st.saveProfile({ ...st.profile, money: st.profile.money + r.money, xp: st.profile.xp + r.xp, paid: [...st.profile.paid.slice(-50), key] });
  }, [r, room, s.flightId, s.hostId]);
  const isHost = s.hostId === myId;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-hud/50 backdrop-blur-sm">
      <div className="w-[26rem] rounded-2xl border border-hud-border bg-hud p-6 shadow-hud">
        <div className="text-xs uppercase tracking-[0.2em] text-signal">{r.crashed ? "Incident report" : "Flight complete"}</div>
        <h2 className="mt-1 font-display text-3xl font-bold">{r.crashed ? "Flight lost" : `Welcome to ${ROUTES[s.routeIdx][2]}`}</h2>
        <p className="mt-1 text-sm text-hud-muted">{r.note}</p>
        <div className="mt-4 space-y-2">
          <Score label="Safety" v={r.safety} />
          <Score label="Punctuality" v={r.punctuality} />
          <Score label="Passenger safety" v={r.satisfaction} />
        </div>
        <div className="mt-4 flex justify-between rounded-lg bg-hud-inset p-3 font-display">
          <span>Earned</span>
          <span className="text-xl font-bold text-ok">+${r.money.toLocaleString()} · +{r.xp} XP</span>
        </div>
        {isHost || !room ? (
          <Button variant="ghost" className="menu-btn mt-4 w-full" onClick={() => dispatch({ t: "next" })}>Next flight →</Button>
        ) : (
          <div className="mt-4 text-center text-sm text-hud-muted">Waiting for the host to start the next flight…</div>
        )}
        <div className="mt-2 text-center text-xs text-hud-muted">New aircraft can be bought in the Hangar from the main menu.</div>
      </div>
    </div>
  );
}

function Score({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono">{v}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-hud-border">
        <div className={`h-full ${v > 65 ? "bg-ok" : v > 40 ? "bg-signal" : "bg-destructive"}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function Help({ role }: { role?: string }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-hud/40" onClick={() => useGame.getState().set({ showHelp: false })}>
      <div className="w-[34rem] rounded-2xl border border-hud-border bg-hud p-6 text-sm shadow-hud">
        <h3 className="font-display text-2xl font-bold">Controls</h3>
        <div className="mt-3 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-signal">Cockpit {role === "pilot" ? "(you)" : ""}</div>
            <ControlsList items={[["W / S", "Throttle up / down"], ["↓ / ↑", "Pitch up / down"], ["← / → or A / D", "Bank / steer"], ["G", "Landing gear"], ["F", "Flaps"], ["Z", "Autopilot"], ["B", "Seatbelt sign"], ["Space", "Brakes"], ["C", "Chase / cockpit cam"]]} />
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-signal">Cabin</div>
            <ControlsList items={[["V", "Switch cockpit / cabin"], ["W / S", "Walk"], ["A / D", "Turn"], ["E (hold)", "Rescue passenger"], ["Mouse", "Look around (click cabin)"], ["Enter", "Chat"], ["H", "Toggle this help"]]} />
          </div>
        </div>
        <p className="mt-4 text-xs text-hud-muted">Gamepad: left stick flies (or walks), triggers set throttle. Landing: line up with the runway, follow the glidepath, gear down, touch down gently.</p>
      </div>
    </div>
  );
}

function ControlsList({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-1">
      {items.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-2">
          <kbd className="rounded bg-hud-inset px-1.5 font-mono text-xs">{k}</kbd>
          <span className="text-right text-hud-muted">{v}</span>
        </li>
      ))}
    </ul>
  );
}
