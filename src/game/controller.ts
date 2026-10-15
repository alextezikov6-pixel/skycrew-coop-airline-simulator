import { useGame, type Need, type Shared } from "./store";
import { applyAction, hostTick, newFlight, type Action } from "./logic";
import { net } from "./net";
import { flight, remotePlane } from "./flight";
import { clearCrewInputs, recordCrewInput, type CrewInput } from "./flightControls";
import { sfx } from "./audio";
import { passengerPosition } from "./rescue";

/** Local attendant avatar, in cabin-local coordinates. */
export const me = { x: 0, z: 1.3, ry: Math.PI };
export const remotes = new Map<string, { x: number; z: number; ry: number; carry: Need | null; inCabin: boolean }>();

let hostTimer: ReturnType<typeof setInterval> | null = null;
let electionTimer: ReturnType<typeof setTimeout> | null = null;
let tickN = 0;
const absentSince = new Map<string, number>();
let hostMissingSince = 0;

export function getMyId(room: string | null) {
  const key = `skycrew-id-${room ?? "solo"}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function isHost() {
  const s = useGame.getState();
  return !!s.shared && s.shared.hostId === s.myId;
}

function commit(s: Shared, broadcast: boolean) {
  s.rev += 1;
  useGame.getState().set({ shared: s });
  if (broadcast && useGame.getState().room) net.send("snap", s);
}

function becomeHost(prev: Shared | null) {
  const st = useGame.getState();
  const s: Shared = prev
    ? { ...structuredClone(prev), hostId: st.myId }
    : newFlight(null, st.myId, st.profile.selected, st.settings.difficulty, st.selectedRoute);
  assignRoles(s);
  commit(s, true);
}

function assignRoles(s: Shared) {
  const st = useGame.getState();
  const roster = st.room ? st.roster : [{ id: st.myId, name: st.name }];
  const present = new Set(roster.map((r) => r.id));
  const now = Date.now();
  for (const r of roster) {
    s.names[r.id] = r.name;
    absentSince.delete(r.id);
  }
  for (const id of Object.keys(s.roles)) {
    if (present.has(id)) continue;
    if (!absentSince.has(id)) absentSince.set(id, now);
    // 15s grace so a disconnected player can rejoin with their role intact
    if (now - (absentSince.get(id) ?? now) > 15000) {
      delete s.roles[id];
      absentSince.delete(id);
    }
  }
  const presentPilot = roster.some((r) => s.roles[r.id] === "pilot");
  let anyPilot = Object.values(s.roles).includes("pilot");
  for (const r of roster) {
    if (!s.roles[r.id]) { s.roles[r.id] = anyPilot || presentPilot ? "attendant" : "pilot"; anyPilot = true; }
  }
  if (!Object.values(s.roles).includes("pilot") && roster[0]) s.roles[roster[0].id] = "pilot";
}

export function dispatch(a: Action) {
  const st = useGame.getState();
  if (!st.shared) return;
  if (a.t === "holdPassenger" && !canHold(st.shared, a.pid, a.from)) return;
  if (isHost()) {
    const s = structuredClone(st.shared);
    applyAction(s, a);
    commit(s, true);
  } else {
    net.send("act", { from: st.myId, flightId: st.shared.flightId, a });
  }
}

function canHold(s: Shared, pid: number, from: string) {
  const st = useGame.getState();
  const p = s.passengers.find(p => p.id === pid);
  const actor = from === st.myId ? { ...me, inCabin: st.view === "cabin" } : remotes.get(from);
  if (!p || !actor?.inCabin || !s.roles[from]) return false;
  const pos = passengerPosition(p);
  return Math.hypot(actor.x - pos.x, actor.z - pos.z) < 1.8;
}

export function flightCommand(control: "gear" | "flaps" | "ap") {
  const st = useGame.getState();
  if (!st.shared) return;
  if (!isHost()) { net.send("flightCommand", { from: st.myId, flightId: st.shared.flightId, control }); return; }
  if (control !== "flaps" && flight.onGround) return;
  flight[control] = !flight[control];
}

function onEvent(event: string, payload: Record<string, unknown>) {
  const st = useGame.getState();
  switch (event) {
    case "flightInput":
      if (isHost() && payload["flightId"] === st.shared?.flightId && st.roster.some((r) => r.id === payload["from"]))
        recordCrewInput(payload["from"] as string, payload["input"] as unknown as CrewInput);
      break;
    case "flightCommand":
      if (isHost() && payload["flightId"] === st.shared?.flightId && st.roster.some((r) => r.id === payload["from"])) {
        const control = payload["control"];
        if (control === "gear" || control === "flaps" || control === "ap") flightCommand(control);
      }
      break;
    case "snap": {
      const s = payload as unknown as Shared;
      if (isHost() && s.hostId !== st.myId) {
        // two hosts: the smaller id wins
        if (s.hostId < st.myId) st.set({ shared: s });
        return;
      }
      st.set({ shared: s });
      break;
    }
    case "act":
      if (isHost() && payload["flightId"] === st.shared?.flightId && st.roster.some(r => r.id === payload["from"])) {
        const a = payload["a"] as Action;
        if (!a || typeof a.t !== "string") break;
        if (a.t === "holdPassenger" && a.from !== payload["from"]) break;
        // Flight outcomes are generated by the snapshot host, never a remote crew action.
        if (a.t === "takeoff" || a.t === "touchdown" || a.t === "parked") break;
        dispatch(a);
      }
      break;
    case "plane": {
      if (isHost() || payload["hostId"] !== st.shared?.hostId || payload["flightId"] !== st.shared?.flightId) break;
      const p = payload as unknown as typeof remotePlane;
      Object.assign(remotePlane, p, { has: true });
      break;
    }
    case "avatar": {
      const p = payload as { id: string; x: number; z: number; ry: number; carry: Need | null; inCabin: boolean };
      if (p.id !== st.myId) remotes.set(p.id, { x: p.x, z: p.z, ry: p.ry, carry: p.carry, inCabin: p.inCabin });
      break;
    }
    case "chat": {
      const m = payload as { id: string; from: string; text: string };
      st.set({ chat: [...st.chat.slice(-30), m] });
      sfx.ding();
      break;
    }
  }
}

export function sendChat(text: string) {
  const st = useGame.getState();
  const m = { id: crypto.randomUUID(), from: st.name, text: text.slice(0, 200) };
  st.set({ chat: [...st.chat.slice(-30), m] });
  net.send("chat", m);
}

export function startSession(room: string | null, name: string) {
  stopSession();
  Object.assign(me, { x: 0, z: 1.3, ry: Math.PI });
  const myId = getMyId(room);
  useGame.getState().set({ myId, room, name, shared: null, chat: [], roster: [{ id: myId, name }], screen: "game", netStatus: room ? "connecting" : "solo" });

  if (!room) {
    becomeHost(null);
  } else {
    net.connect(room, myId, name, {
      onStatus: (status) => {
        useGame.getState().set({ netStatus: status });
        if (status === "SUBSCRIBED" && !electionTimer) {
          electionTimer = setTimeout(() => {
            if (!useGame.getState().shared) becomeHost(null);
          }, 1800);
        }
      },
      onRoster: (roster) => {
        useGame.getState().set({ roster: roster.sort((a, b) => (a.id < b.id ? -1 : 1)) });
      },
      onEvent,
    });
  }

  hostTimer = setInterval(() => {
    const st = useGame.getState();
    if (!st.shared) return;
    if (isHost()) {
      const s = structuredClone(st.shared);
      hostTick(s, 0.25);
      assignRoles(s);
      tickN++;
      commit(s, tickN % 2 === 0);
    } else if (st.room) {
      // host migration: if the host left, the smallest remaining id takes over
      const hostId = st.shared.hostId;
      const hostPresent = st.roster.some((r) => r.id === hostId);
      if (hostPresent) hostMissingSince = 0;
      else {
        if (!hostMissingSince) hostMissingSince = Date.now();
        if (Date.now() - hostMissingSince > 3000 && st.roster[0]?.id === st.myId) {
          hostMissingSince = 0;
          becomeHost(st.shared);
        }
      }
    }
  }, 250);
}

export function stopSession() {
  if (hostTimer) clearInterval(hostTimer);
  if (electionTimer) clearTimeout(electionTimer);
  hostTimer = null;
  electionTimer = null;
  net.disconnect();
  remotes.clear();
  clearCrewInputs();
  absentSince.clear();
  hostMissingSince = 0;
  remotePlane.has = false;
}
