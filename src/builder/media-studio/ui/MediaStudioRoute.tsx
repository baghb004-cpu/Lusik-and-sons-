"use client";

import dynamic from "next/dynamic";

const MediaStudio = dynamic(() => import("./MediaStudio.tsx").then((m) => m.MediaStudio), {
  ssr: false,
  loading: () => <div className="flex min-h-[50vh] items-center justify-center font-body text-muted">Loading the Media Studio…</div>,
});

export function MediaStudioRoute() {
  return <MediaStudio />;
}
