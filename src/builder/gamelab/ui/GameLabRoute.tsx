"use client";

import dynamic from "next/dynamic";

const GameLab = dynamic(() => import("./GameLab.tsx").then((m) => m.GameLab), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading Game Lab…</div>,
});

export function GameLabRoute() {
  return <GameLab />;
}
