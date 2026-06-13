"use client";

import dynamic from "next/dynamic";

const PhotoBoothBuilder = dynamic(() => import("./PhotoBoothBuilder.tsx").then((m) => m.PhotoBoothBuilder), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Photo Booth Builder…</div>,
});

export function PhotoBoothRoute() {
  return <PhotoBoothBuilder />;
}
