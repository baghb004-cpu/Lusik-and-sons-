"use client";

import dynamic from "next/dynamic";

const GalleryView = dynamic(() => import("../components/GalleryView.jsx").then((m) => m.GalleryView), { ssr: false });

export function GalleryRoute() {
  return <GalleryView />;
}

export default GalleryRoute;
