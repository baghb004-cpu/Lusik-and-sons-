// /tools/game-lab — the offline Game Lab mini-game builder (§29).
// Server shell only; the builder is a client bundle loaded dynamically.
// Noindexed — it's a personal, local tool.

import type { Metadata } from "next";
import { GameLabRoute } from "../../../src/builder/gamelab/ui/GameLabRoute.tsx";

export const metadata: Metadata = {
  title: "Game Lab",
  robots: { index: false, follow: false },
};

export default function GameLabPage() {
  return <GameLabRoute />;
}
