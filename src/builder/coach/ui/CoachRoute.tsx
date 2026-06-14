"use client";

import dynamic from "next/dynamic";

const CommunicationCoach = dynamic(() => import("./CommunicationCoach.tsx").then((m) => m.CommunicationCoach), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Communication Coach…</div>,
});

export function CoachRoute() {
  return <CommunicationCoach />;
}
