// ============================================================
// RENDERER — WebGL setup and an on-demand frame loop
// ============================================================
// Two things this does that a default three.js setup does not:
//
// 1. Colour management is pinned. outputColorSpace is sRGB and tone
//    mapping is OFF. The thread colours are real DMC hex values that the
//    2D preview, the cart thumbnail and the printed brochure all show; a
//    filmic tone curve would make the 3D one quietly disagree with the
//    rest, and a customer choosing "Navy 311" would see a different navy
//    depending on which surface they looked at.
//
// 2. It renders on demand. A free-running rAF loop costs battery for a
//    picture of a blanket that is not moving. Frames are drawn only when
//    something asks for one, and only while the canvas is on screen.
// ============================================================

import {
  NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer,
} from "three";
import { LOOM_SETTINGS } from "../tier.js";

/** @see LOOM_SETTINGS */
export type LoomTier = "high" | "mid" | "low";

export interface RendererHandle {
  renderer: WebGLRenderer;
  /** Ask for a frame. Cheap and idempotent within a frame. */
  invalidate: () => void;
  /** Resize to the container's box. No-op when unchanged. */
  resize: (width: number, height: number) => void;
  /** Start the loop. Returns a stop function. */
  start: (render: () => void) => () => void;
  /** Release GPU resources. */
  dispose: () => void;
  /** Pause the loop while the canvas is off screen. */
  setVisible: (visible: boolean) => void;
}

export interface CreateRendererOptions {
  canvas: HTMLCanvasElement;
  tier: LoomTier;
  /** Called when the browser takes the GL context away. */
  onContextLost?: () => void;
}

export function createRenderer({ canvas, tier, onContextLost }: CreateRendererOptions): RendererHandle {
  const settings = LOOM_SETTINGS[tier];

  const renderer = new WebGLRenderer({
    canvas,
    antialias: tier === "high",
    alpha: true,
    powerPreference: tier === "high" ? "high-performance" : "default",
    // The stage sits over a poster image; without this the crossfade
    // shows a black rectangle for one frame on some drivers.
    premultipliedAlpha: true,
  });

  renderer.outputColorSpace = SRGBColorSpace;
  // Deliberately NOT a filmic curve — see the header.
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = settings.shadows;

  let disposed = false;
  let frameRequested = false;
  let rafId = 0;
  let renderFn: (() => void) | null = null;
  let visible = true;

  const invalidate = () => {
    if (disposed || !visible || frameRequested || !renderFn) return;
    frameRequested = true;
    rafId = requestAnimationFrame(() => {
      frameRequested = false;
      if (disposed || !renderFn) return;
      renderFn();
    });
  };

  // Tracked here rather than read back from the renderer: getSize() wants a
  // Vector2 target and allocating one per resize is pointless churn.
  let lastW = 0;
  let lastH = 0;
  let lastDpr = 0;

  const resize = (width: number, height: number) => {
    if (disposed || width <= 0 || height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, settings.dprCap);
    if (width === lastW && height === lastH && dpr === lastDpr) return;
    lastW = width; lastH = height; lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    invalidate();
  };

  // A lost context is not an error to log and forget: without preventDefault
  // the browser will not restore it, and the stage would sit blank forever.
  const handleLost = (event: Event) => {
    event.preventDefault();
    onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", handleLost, false);

  const start = (render: () => void) => {
    renderFn = render;
    invalidate();
    return () => { renderFn = null; };
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    renderFn = null;
    canvas.removeEventListener("webglcontextlost", handleLost);
    renderer.dispose();
    // forceContextLoss frees the GPU side immediately rather than waiting
    // for GC, which matters on phones where the next page also wants a
    // context.
    renderer.forceContextLoss();
  };

  const setVisible = (v: boolean) => {
    visible = v;
    if (v) invalidate();
  };

  return { renderer, invalidate, resize, start, dispose, setVisible };
}

/** Dispose every geometry, material and texture reachable from a scene. */
export function disposeScene(scene: Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as unknown as {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | { dispose?: () => void }[];
    };
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose?.());
    else material?.dispose?.();
  });
}

/** A camera framing a flat-lay piece; the rig overrides position per pose. */
export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(35, aspect, 0.1, 100);
  camera.position.set(0, 1.6, 2.2);
  camera.lookAt(0, 0, 0);
  return camera;
}
