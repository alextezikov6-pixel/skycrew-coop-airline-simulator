import { createFileRoute } from "@tanstack/react-router";
import { Game } from "../game/Game";
import { useGame } from "../game/store";
import { Menu } from "../game/ui/Menu";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  const screen = useGame((state) => state.screen);
  return screen === "menu" ? <Menu /> : <Game />;
}
