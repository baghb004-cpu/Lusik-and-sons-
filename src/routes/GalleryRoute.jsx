"use client";

// SSR: direct import (was dynamic({ ssr:false })) so the server renders the
// real gallery content in the initial HTML. GalleryView is SSR-safe — all
// window/document access (keyboard handler) is inside effects.
import { GalleryView } from "../components/GalleryView.jsx";

export function GalleryRoute() {
  return <GalleryView />;
}

export default GalleryRoute;
