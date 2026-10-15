import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface NetHandlers {
  onStatus: (s: string) => void;
  onRoster: (r: { id: string; name: string }[]) => void;
  onEvent: (event: string, payload: Record<string, unknown>) => void;
}

/** One realtime channel per room. Created once per session, always torn down. */
class Net {
  channel: RealtimeChannel | null = null;
  ready = false;

  connect(room: string, myId: string, name: string, h: NetHandlers) {
    this.disconnect();
    const channel = supabase.channel(`skycrew:${room}`, {
      config: { broadcast: { self: false }, presence: { key: myId } },
    });
    for (const ev of ["snap", "act", "plane", "avatar", "chat", "flightInput", "flightCommand"]) {
      channel.on("broadcast", { event: ev }, ({ payload }) => h.onEvent(ev, payload));
    }
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ name: string }>();
      h.onRoster(
        Object.entries(state).map(([id, metas]) => ({ id, name: metas[0]?.name ?? "Crew" })),
      );
    });
    channel.subscribe((status) => {
      console.log("[net] channel:", status);
      this.ready = status === "SUBSCRIBED";
      h.onStatus(status);
      if (status === "SUBSCRIBED") void channel.track({ name });
    });
    this.channel = channel;
  }

  send(event: string, payload: unknown) {
    if (!this.channel || !this.ready) return;
    void this.channel.send({ type: "broadcast", event, payload });
  }

  disconnect() {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
      this.ready = false;
    }
  }
}

export const net = new Net();
