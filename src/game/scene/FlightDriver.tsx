import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AIRCRAFT, GLIDE, RUNWAY_LEN, routeDetails } from "../aircraft";
import { audioUpdate } from "../sessionAudio";
import { dispatch, me } from "../controller";
import { distToDest, flight, remotePlane, resetFlight, stepFlight } from "../flight";
import { gamepadAxes, keys } from "../input";
import { maxTouchdownVs } from "../logic";
import { net } from "../net";
import { clearCrewInputs, combinedCrewInput, neutralInput } from "../flightControls";
import { useGame } from "../store";
import { stepHazards } from "../hazards";
import { rescueTarget } from "../rescue";

const NET_TICK = 1 / 8;

/** Runs flight simulation (pilot) or interpolation (others), network sends and HUD sampling. */
export function FlightDriver() {
  const lastFlightId = useRef(-1);
  const acc = useRef(0);
  const hudAcc = useRef(0);
  const keepalive = useRef(0);
  const parkedSent = useRef(false);
  const inputAcc = useRef(0);
  const lastInput = useRef("");
  const lastInputAt = useRef(0);
  const holdAcc = useRef(0);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const st = useGame.getState();
    const s = st.shared;
    if (!s) return;
    const pilot = s.hostId === st.myId;
    const route = routeDetails(s.routeIdx);
    const ac = AIRCRAFT[s.aircraft];
    holdAcc.current += dt;
    if (st.view === "cabin" && keys.has("KeyE") && !document.hidden && holdAcc.current >= 0.2) {
      holdAcc.current = 0;
      const target = rescueTarget(s.passengers, me.x, me.z);
      if (target) dispatch({ t: "holdPassenger", pid: target.id, from: st.myId });
    }

    if (s.flightId !== lastFlightId.current) {
      lastFlightId.current = s.flightId;
      resetFlight();
      clearCrewInputs();
      remotePlane.has = false;
      parkedSent.current = false;
      st.set({ carry: null });
    }

    {
      const outside = st.view === "outside";
      const gp = gamepadAxes();
      let pitch = 0;
      let roll = 0;
      let thr = 0;
      if (outside) {
        const inv = st.settings.invertPitch ? -1 : 1;
        pitch = ((keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0)) * inv;
        roll = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
        thr = (keys.has("KeyW") || keys.has("ShiftLeft") ? 1 : 0) - (keys.has("KeyS") || keys.has("ControlLeft") ? 1 : 0);
        if (gp) {
          pitch += gp.pitch * inv;
          roll += gp.roll;
          thr += gp.thr;
        }
      }
      const local = document.hidden ? neutralInput() : { pitch, roll, thr, brake: outside && keys.has("Space") };
      inputAcc.current += dt;
      const encoded = JSON.stringify(local);
      if (!pilot && st.room && !document.hidden && inputAcc.current >= NET_TICK && (encoded !== lastInput.current || Date.now() - lastInputAt.current > 700)) {
        inputAcc.current = 0; lastInput.current = encoded; lastInputAt.current = Date.now();
        net.send("flightInput", { from: st.myId, flightId: s.flightId, input: local });
      }
      if (pilot) {
      const combined = combinedCrewInput(local, st.roster.filter((r) => r.id !== st.myId).map((r) => r.id));
      flight.brake = flight.onGround && (combined.brake || (flight.throttle < 0.05 && flight.speed < 3));
      const locked = s.phase === "boarding" || s.phase === "results";
      const ev = stepFlight(flight, combined, ac, dt, { locked, maxVs: maxTouchdownVs(s.difficulty), distance: route.distance, altitude: route.altitude });
      if (stepHazards(useGame.getState().shared ?? s, flight, dt)) dispatch({ t: "touchdown", vs: 0, ok: false, reason: "Aircraft destroyed by airborne hazards." });
      if (ev?.t === "takeoff") dispatch({ t: "takeoff" });
      if (ev?.t === "touchdown") dispatch(ev);
      if (s.phase === "ready" && flight.airborne) dispatch({ t: "takeoff" });
      if (s.phase === "landed" && flight.onGround && flight.speed < 1.5 && !parkedSent.current) {
        flight.parkedT += dt;
        if (flight.parkedT > 2) {
          parkedSent.current = true;
          dispatch({ t: "parked" });
        }
      }

      acc.current += dt;
      if (acc.current >= NET_TICK && st.room && !document.hidden) {
        acc.current = 0;
        const r = (v: number) => Math.round(v * 100) / 100;
        net.send("plane", {
          hostId: s.hostId, flightId: s.flightId, airborne: flight.airborne, crashed: flight.crashed,
          x: r(flight.x), y: r(flight.y), z: r(flight.z), yaw: r(flight.yaw), pitch: r(flight.pitch), roll: r(flight.roll),
          speed: r(flight.speed), vy: r(flight.vy), throttle: r(flight.throttle), gear: flight.gear, flaps: flight.flaps,
          ap: flight.ap, onGround: flight.onGround, brake: flight.brake,
        });
      }
      }
    }
    if (!pilot && remotePlane.has) {
      const k = 1 - Math.exp(-10 * dt);
      if (Math.hypot(remotePlane.x - flight.x, remotePlane.z - flight.z) > 200) {
        Object.assign(flight, { x: remotePlane.x, y: remotePlane.y, z: remotePlane.z });
      }
      flight.x += (remotePlane.x - flight.x) * k;
      flight.y += (remotePlane.y - flight.y) * k;
      flight.z += (remotePlane.z - flight.z) * k;
      for (const key of ["yaw", "pitch", "roll"] as const) {
        const d = remotePlane[key] - flight[key];
        flight[key] += Math.atan2(Math.sin(d), Math.cos(d)) * k;
      }
      flight.speed = remotePlane.speed;
      flight.vy = remotePlane.vy;
      flight.throttle = remotePlane.throttle;
      flight.gear = remotePlane.gear;
      flight.flaps = remotePlane.flaps;
      flight.ap = remotePlane.ap;
      flight.onGround = remotePlane.onGround;
      flight.crashed = remotePlane.crashed;
      flight.airborne = remotePlane.airborne;
      flight.brake = remotePlane.brake;
      // keep the plane moving forward between packets
      remotePlane.x += -Math.sin(remotePlane.yaw) * remotePlane.speed * Math.cos(remotePlane.pitch) * dt;
      remotePlane.z += -Math.cos(remotePlane.yaw) * remotePlane.speed * Math.cos(remotePlane.pitch) * dt;
      remotePlane.y = Math.max(0, remotePlane.y + remotePlane.vy * dt);
    }

    // attendant avatar sync (any role)
    keepalive.current += dt;
    if (st.room && keepalive.current >= NET_TICK && !document.hidden) {
      keepalive.current = 0;
      net.send("avatar", {
        id: st.myId, x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, ry: Math.round(me.ry * 100) / 100,
        carry: st.carry, inCabin: st.view === "cabin",
      });
    }

    hudAcc.current += dt;
    if (hudAcc.current > 0.1) {
      hudAcc.current = 0;
      const dist = distToDest(flight, route.distance);
      const toThreshold = Math.max(0, -(-route.distance + RUNWAY_LEN / 2) + flight.z);
      st.set({
        hud: {
          kt: Math.round(flight.speed * 1.944),
          ft: Math.round(flight.y * 3.281),
          fpm: Math.round(flight.vy * 196.85),
          hdg: Math.round(((((-flight.yaw * 180) / Math.PI) % 360) + 360) % 360),
          thr: Math.round(flight.throttle * 100),
          gear: flight.gear,
          flaps: flight.flaps,
          ap: flight.ap,
          brake: flight.brake,
          onGround: flight.onGround,
          distKm: Math.round(dist / 100) / 10,
          glideFt: Math.round(Math.min(route.altitude, toThreshold * GLIDE) * 3.281),
        },
      });
      audioUpdate(flight.throttle, flight.speed, st.view === "cabin");
    }
  });
  return null;
}
