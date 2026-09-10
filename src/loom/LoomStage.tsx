"use client";

// ============================================================
// LOOM STAGE — the engine on a page, or gracefully not
// ============================================================
// Poster first, always. The <img> is the LCP element and the canvas
// fades over it once the first frame exists, in the same sized box so
// nothing shifts. If the engine never loads — a `low` device, no WebGL,
// a lost context, the flag off — the poster simply stays, and the 2D
// BlanketLayoutPreview beside it is still the live preview. There is no
// state in which this shows a blank rectangle.
//
// It never loads eagerly. The engine waits for idle after the page's
// load event, or for the first real interaction with the stage or the
// configurator, whichever comes first. Someone who scrolls past a
// product without touching it pays nothing.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "../data/config.js";
import { getGpuSignal, getTier } from "../lib/capability";
import { LOOM_BUILD_TAG } from "./buildTag";
import { readLoomOverride, resolveLoomTier, LOOM_SETTINGS } from "./tier.js";
import type { BibDesign, HyeEmYesDesign, LoomDesign } from "./types";

export type { LoomDesign } from "./types";

export interface LoomStageProps {
  /** Which rig to build. Must be listed in CONFIG.LOOM.PRODUCTS. */
  productKey: string;
  /**
   * Poster shown until (and instead of) the first frame. Ignored when
   * `fallback` is given.
   */
  poster?: string;
  /**
   * Rendered instead of a poster image. In the configurator this is the
   * 2D BlanketLayoutPreview, which is a far better fallback than a still:
   * it is already live, so a customer on a device that cannot run the
   * engine still watches their child's name appear as they type.
   */
  fallback?: React.ReactNode;
  /** Text alternative — describes the DESIGN, not the widget. */
  label: string;
  /** The design. Changing it restitches; planning happens in the engine chunk. */
  design: LoomDesign | BibDesign | HyeEmYesDesign;
  /** Body colour of the cloth. */
  clothColor?: string;
  className?: string;
}

type Phase = "poster" | "loading" | "live" | "failed";

export function LoomStage({
  productKey, poster, fallback, label, design, clothColor, className,
}: LoomStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{ dispose: () => void } | null>(null);
  // Stitch-in animation state. `shown` is fractional; the mesh floors it.
  // `startedAt` is what makes STITCH_IN_MS a duration rather than a wish —
  // see the frame loop.
  const revealRef = useRef({ shown: 0, total: 0, animating: false, startedAt: 0 });
  const applyRef = useRef<((d: LoomStageProps["design"]) => void) | null>(null);
  const [phase, setPhase] = useState<Phase>("poster");
  const [armed, setArmed] = useState(false);

  const enabled =
    CONFIG.LOOM?.ENABLED !== false &&
    (CONFIG.LOOM?.PRODUCTS ?? []).includes(productKey);

  // ---- arm: idle after load, or first interaction, whichever is first ----
  useEffect(() => {
    if (!enabled || armed) return;
    let cancelled = false;
    const arm = () => { if (!cancelled) setArmed(true); };

    const host = hostRef.current;
    const opts = { once: true, passive: true } as AddEventListenerOptions;
    host?.addEventListener("pointerdown", arm, opts);
    host?.addEventListener("pointermove", arm, opts);
    host?.addEventListener("focusin", arm, opts);
    // The configurator publishes design changes; typing a name should
    // bring the stage up even if the customer never touched it.
    window.addEventListener("design:change", arm, opts);

    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    const schedule = () => (idle ? idle(arm, { timeout: 4000 }) : window.setTimeout(arm, 1200));
    let handle: number | undefined;
    if (document.readyState === "complete") handle = schedule();
    else window.addEventListener("load", () => { handle = schedule(); }, { once: true });

    return () => {
      cancelled = true;
      host?.removeEventListener("pointerdown", arm);
      host?.removeEventListener("pointermove", arm);
      host?.removeEventListener("focusin", arm);
      window.removeEventListener("design:change", arm);
      if (handle !== undefined) window.clearTimeout(handle);
    };
  }, [enabled, armed]);

  // ---- mount the engine ----
  useEffect(() => {
    if (!enabled || !armed || engineRef.current) return;
    let disposed = false;

    const tier = resolveLoomTier({
      capabilityTier: getTier(),
      gpu: getGpuSignal(),
      override: readLoomOverride(),
    }).tier;

    // `low` is not a failure. The poster is the product photo and the 2D
    // preview is still live; loading three.js here would be the failure.
    if (tier === "low") return;

    setPhase("loading");
    let contextLosses = 0;

    (async () => {
      try {
        // Planning lives in the engine chunk too: importing the planner and
        // the glyph rasteriser from page code would put them in the route's
        // first-load JS for a feature most visitors never trigger.
        const [
          { createRenderer, createCamera }, { createScene }, { createRigFor },
          { createOrbit, POSES },
        ] = await Promise.all([
          import("./core/renderer"),
          import("./core/scene"),
          import("./rigs/index"),
          import("./core/camera"),
        ]);
        if (disposed) return;
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (!canvas || !host) return;

        const settings = LOOM_SETTINGS[tier];
        const renderer = createRenderer({
          canvas,
          tier,
          onContextLost: () => {
            contextLosses += 1;
            // Twice is a driver saying no. Fall back rather than thrash.
            if (contextLosses >= 2) { setPhase("failed"); engineRef.current?.dispose(); }
          },
        });
        const { scene } = createScene(settings.shadows);
        const rect = host.getBoundingClientRect();
        const camera = createCamera(Math.max(0.5, rect.width / Math.max(1, rect.height)));
        const rig = createRigFor(productKey, { textureSize: settings.textureSize, clothColor });
        if (!rig) {
          // No rig for this product yet. The poster (or fallback) is a
          // correct thing to show, so this is not a failure.
          renderer.dispose();
          return;
        }
        scene.add(rig.group);

        const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        const orbit = createOrbit(camera, POSES.flat, { reducedMotion: reduced });

        // Whether the stage is on screen. The renderer stops drawing when
        // it is not, so a reveal started off screen has no frames to run
        // in: it would sit at zero, and the customer scrolling back would
        // find a piece that never got stitched. The IntersectionObserver
        // below keeps this current.
        let visible = true;
        // The stitch-in plays ONCE, when the piece first appears.
        //
        // Replaying it on every design change means typing a name
        // unstitches the whole piece and works it back in per keystroke:
        // four letters, four full restarts, the entire alphabet blanket
        // vanishing and redrawing each time. The handoff plan is explicit
        // that unchanged stitches must not flicker, and this is the
        // cheapest way to honour it — the letters themselves changing IS
        // the feedback a customer is looking for while they type.
        let workedInOnce = false;

        const applyDesign = (d: LoomStageProps["design"]) => {
          const total = rig.apply(d);
          // How many stitches the piece is made of. A dataset attribute
          // rather than state, for the same reason as loomStitching below,
          // and it is what an e2e test can assert grows as a name is typed.
          host.dataset.loomStitches = String(total);
          // Work the piece in rather than popping it into existence. The
          // planner already ordered the stitches the way a person works
          // them — across each row, outlines last — so replaying that
          // order reads as stitching. Under reduced motion it is just
          // there. A rig reporting 0 (the machine-embroidered bib) has
          // nothing to work in — and neither has a stage nobody is
          // looking at, which is the case that bit: changing a colourway
          // with the stage scrolled away armed an animation that no frame
          // ever advanced.
          if (reduced() || total === 0 || !rig.setRevealed || !visible || workedInOnce) {
            revealRef.current = { shown: total, total, animating: false, startedAt: 0 };
            host.dataset.loomStitching = "false";
          } else {
            rig.setRevealed(0);
            workedInOnce = true;
            revealRef.current = { shown: 0, total, animating: true, startedAt: performance.now() };
            // A plain dataset write rather than React state: this flips
            // twice per restitch and a re-render of the whole PDP for it
            // would be absurd. It exists so a test can assert the piece
            // is worked in rather than popped in — the animation is over
            // in well under two seconds, which is too fast to catch
            // reliably by screenshotting.
            host.dataset.loomStitching = "true";
          }
          // Rendering is on demand, so changing the design changes nothing
          // on screen until a frame is asked for. Without this the canvas
          // keeps showing the previous state: the bib stayed bare while the
          // customer typed their child's name into it, and the blanket only
          // ever appeared to restitch because MOUNTING requests a frame.
          renderer.invalidate();
        };
        applyDesign(design);
        applyRef.current = applyDesign;

        // A rig may restitch itself without the design changing — the
        // letterforms come from a webfont, so the piece is planned once in
        // the fallback face and again when the real one lands. The reveal
        // is counting toward a total that just changed underneath it.
        rig.onRestitch?.((newTotal) => {
          const reveal = revealRef.current;
          reveal.total = newTotal;
          host.dataset.loomStitches = String(newTotal);
          // Already finished working the piece in: show the new plan
          // whole rather than replaying the animation, which would look
          // like the bib unstitching itself a second after it settled.
          if (!reveal.animating) {
            reveal.shown = newTotal;
            rig.setRevealed?.(newTotal);
          }
          renderer.invalidate();
        });

        let last = performance.now();
        const frame = () => {
          const now = performance.now();
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;

          const reveal = revealRef.current;
          if (reveal.animating && rig.setRevealed) {
            // A fixed DURATION rather than a fixed rate: a six-letter
            // blanket and a full alphabet should both finish in about the
            // same beat, or the big one would crawl.
            //
            // Measured against the CLOCK, not against accumulated frame
            // deltas. Those deltas are clamped to 50 ms so a backgrounded
            // tab does not resume with one enormous jump — which means a
            // renderer managing four frames a second advances the reveal
            // at a fifth of real time. On a software renderer (the `mid`
            // tier, and every CI machine) a 1.4 second stitch-in then took
            // half a minute, and the piece simply sat there with a third
            // of its stitches, looking like a broken chart rather than a
            // slow animation. Elapsed time cannot drift like that.
            const ms = Math.max(1, CONFIG.LOOM?.STITCH_IN_MS ?? 1400);
            const progress = Math.min(1, (now - reveal.startedAt) / ms);
            reveal.shown = reveal.total * progress;
            rig.setRevealed(reveal.shown);
            if (progress >= 1) {
              reveal.shown = reveal.total;
              rig.setRevealed(reveal.total);
              reveal.animating = false;
              host.dataset.loomStitching = "false";
            }
          }

          const moving = orbit.update(dt);
          renderer.renderer.render(scene, camera);
          if (moving || reveal.animating) renderer.invalidate();
        };
        renderer.start(frame);

        // Drag to turn the piece. Pointer events cover mouse, touch and
        // pen; scrolling a phone fires pointercancel, which ends the drag
        // rather than dragging the blanket along with the page.
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const onDown = (e: PointerEvent) => {
          dragging = true; lastX = e.clientX; lastY = e.clientY;
          host.setPointerCapture?.(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          orbit.orbitBy((lastX - e.clientX) * 0.006, (lastY - e.clientY) * 0.005);
          lastX = e.clientX; lastY = e.clientY;
          renderer.invalidate();
        };
        const endDrag = (e: PointerEvent) => {
          dragging = false;
          host.releasePointerCapture?.(e.pointerId);
        };
        host.addEventListener("pointerdown", onDown);
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerup", endDrag);
        host.addEventListener("pointercancel", endDrag);

        const ro = new ResizeObserver(() => {
          const r = host.getBoundingClientRect();
          camera.aspect = Math.max(0.5, r.width / Math.max(1, r.height));
          camera.updateProjectionMatrix();
          renderer.resize(r.width, r.height);
        });
        ro.observe(host);

        // Only render while on screen. A canvas scrolled away is a canvas
        // that should cost nothing.
        const io = new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            renderer.setVisible(entry.isIntersecting);
            // Scrolling away mid-stitch would freeze the piece half-worked:
            // the loop stops, so the reveal stops, and scrolling back finds
            // a blanket with half its letters missing. Nobody saw the
            // animation anyway, so finish it.
            if (!entry.isIntersecting && revealRef.current.animating && rig.setRevealed) {
              const reveal = revealRef.current;
              reveal.shown = reveal.total;
              reveal.animating = false;
              rig.setRevealed(reveal.total);
              host.dataset.loomStitching = "false";
            }
          },
          { rootMargin: "128px" },
        );
        io.observe(host);

        renderer.resize(rect.width, rect.height);
        renderer.invalidate();
        requestAnimationFrame(() => { if (!disposed) setPhase("live"); });

        engineRef.current = {
          dispose: () => {
            host.removeEventListener("pointerdown", onDown);
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerup", endDrag);
            host.removeEventListener("pointercancel", endDrag);
            ro.disconnect();
            io.disconnect();
            orbit.dispose();
            rig.dispose();
            renderer.dispose();
          },
        };
      } catch {
        // Any failure at all lands on the poster, never a blank box.
        if (!disposed) setPhase("failed");
      }
    })();

    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // `stitches` deliberately omitted: a design change restitches through
    // the effect below rather than tearing the whole engine down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, armed, productKey, clothColor]);

  // ---- restitch on a design change ----
  useEffect(() => {
    applyRef.current?.(design);
  }, [design]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") setArmed(true);
  }, []);

  const crossfade = phase === "live";

  return (
    <div
      ref={hostRef}
      className={className}
      data-loom={LOOM_BUILD_TAG}
      data-loom-phase={phase}
      // The stage is a picture of the product. Screen readers get the
      // design described in words; the canvas itself says nothing useful.
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        width: "100%",
        // With a fallback the FALLBACK defines the box and the canvas
        // overlays exactly it. Imposing an aspect ratio here instead
        // clipped the square 2D preview into a 4:3 window and cut the top
        // and bottom rows off the blanket — for every visitor whose device
        // cannot run the engine, which is the audience the fallback exists
        // for. Only the poster-image path needs a shape of its own.
        aspectRatio: fallback ? undefined : "4 / 3",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          // In flow when it is a fallback (so it sizes the host), absolute
          // when it is a poster image (so the canvas can sit on top).
          position: fallback ? "relative" : "absolute",
          inset: fallback ? undefined : 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: crossfade ? 0 : 1,
          transition: `opacity ${CONFIG.LOOM?.CROSSFADE_MS ?? 250}ms ease`,
        }}
      >
        {fallback ?? (poster
          ? <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : null)}
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: crossfade ? 1 : 0,
          transition: `opacity ${CONFIG.LOOM?.CROSSFADE_MS ?? 250}ms ease`,
        }}
      />
    </div>
  );
}
