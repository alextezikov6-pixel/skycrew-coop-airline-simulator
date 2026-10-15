import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { dispatch, flightCommand, me } from "./controller";
import { flight } from "./flight";
import { bindKeys, isTyping } from "./input";
import { Cabin } from "./scene/Cabin";
import { FlightDriver } from "./scene/FlightDriver";
import { World } from "./scene/World";
import { useGame } from "./store";
import { HUD } from "./ui/HUD";

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function NoWebGL() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="font-display text-2xl font-bold">3D graphics unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your browser couldn't start 3D graphics (WebGL). Turn on hardware acceleration in your browser settings,
          close other 3D tabs, or open the game in a new tab, then reload.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="menu-btn" onClick={() => window.location.reload()}>Reload</button>
          <button className="menu-btn-alt" onClick={() => useGame.getState().set({ screen: "menu" })}>Back to menu</button>
        </div>
      </div>
    </div>
  );
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(e: unknown) {
    console.warn("3D renderer failed to start:", e);
  }
  override render() {
    return this.state.failed ? <NoWebGL /> : this.props.children;
  }
}

export function Game() {
  const ok = useState(() => webglAvailable())[0];
  return ok ? (
    <GLBoundary>
      <GameInner />
    </GLBoundary>
  ) : (
    <NoWebGL />
  );
}

function GameInner() {
  const view = useGame((s) => s.view);

  useEffect(() => {
    const unbind = bindKeys();
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return;
      const st = useGame.getState();
      const s = st.shared;
      if (!s) return;
      switch (e.code) {
        case "KeyV":
          st.set({ view: st.view === "cabin" ? "outside" : "cabin" });
          return;
        case "KeyH":
          st.set({ showHelp: !st.showHelp });
          return;
        case "KeyB":
          dispatch({ t: "seatbelt", on: !s.seatbelt });
          return;
      }
      if (st.view === "outside") {
        if (e.code === "KeyC") st.set({ cam: st.cam === "chase" ? "cockpit" : "chase" });
        if (e.code === "KeyG") flightCommand("gear");
        if (e.code === "KeyF") flightCommand("flaps");
        if (e.code === "KeyZ") flightCommand("ap");
        return;
      }
      // cabin interactions
      if (e.code === "KeyE") {
        if (me.z < 0.9 && Math.abs(me.x - 0.3) < 0.7) {
          st.set({ view: "outside", cam: "cockpit" });
          return;
        }
        if (Math.hypot(me.x + 1.05, me.z - 1.2) < 0.9) dispatch({ t: "closeDoor" });
      }
    };
    window.addEventListener("keydown", onDown);
    return () => {
      unbind();
      window.removeEventListener("keydown", onDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "default", failIfMajorPerformanceCaveat: false }}
        fallback={<NoWebGL />}
        camera={{ position: [0, 10, 300], fov: 60, near: 0.5, far: 40000 }}
      >
        <Suspense fallback={null}>{view === "outside" ? <World /> : <Cabin />}</Suspense>
        <FlightDriver />
      </Canvas>
      <HUD />
    </div>
  );
}
