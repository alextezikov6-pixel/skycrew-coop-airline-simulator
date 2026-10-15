<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Game code lives in src/game (flight, logic, controller/net, scene, ui); multiplayer is client-authoritative over Cloud Realtime broadcast with a host-owned shared snapshot — no game server exists on the platform.

- The snapshot host alone simulates the shared aircraft; other crew send expiring clamped inputs and discrete commands, so two controllers never simulate competing planes.
- Route metadata in aircraft.ts drives runway placement, navigation, scoring, flight altitude, and route selection so route names cannot diverge from the flight map.
- Passenger rescue timers, hold leases and hazard outcomes live in the host-owned shared snapshot; cabin actions are proximity-checked and flight hazards advance only on the snapshot host to avoid divergent outcomes.
