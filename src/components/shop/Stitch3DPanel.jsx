// ============================================================
// Stitch3DPanel — the Embroidery Studio's 3D stage, on the PDP
// ============================================================
// Continuity play: every live product page gets the same live-3D
// stitch treatment the /embroidery studio has — the SAME engine,
// embedded via an iframe to public/embroidery/stage.html and driven
// over postMessage. Three.js therefore never enters the Next bundle
// (the 210KB first-load budget is untouched); it loads inside the
// frame, and only once the panel scrolls near the viewport.
//
// Interactions:
//   - drag to spin / scroll to zoom (handled inside the stage)
//   - a thread-swatch strip restitches the signature text in a new
//     color right on the page
//   - personalizable products (custom bib, alphabet blanket) dispatch
//     window CustomEvent("stitch3d:live", {detail:{text?, thread?}})
//     from their configurators; the panel restitches as you type
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { STITCH_PREVIEWS, STITCH_THREADS } from "../../data/stitchPreviews.js";
import { useT } from "../../i18n/LangContext.jsx";

export function Stitch3DPanel({ productKey, className = "" }) {
  const t = useT();
  const base = STITCH_PREVIEWS[productKey];
  const [nearViewport, setNearViewport] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [thread, setThread] = useState(base?.thread);
  const hostRef = useRef(null);
  const iframeRef = useRef(null);
  // Mutable current config — live events merge in without re-rendering.
  const cfgRef = useRef(base ? { ...base } : null);

  // Load the stage only when the shopper approaches it.
  useEffect(() => {
    if (!base || nearViewport) return;
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setNearViewport(true); io.disconnect(); } },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [base, nearViewport]);

  const post = (restitch = "slow") => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !cfgRef.current) return;
    win.postMessage({ type: "stitch", ...cfgRef.current, restitch }, "*");
  };

  // Stage handshake: it announces readiness, we send the current design.
  useEffect(() => {
    if (!base) return;
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "stitch-ready") { setFrameReady(true); post("slow"); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, nearViewport]);

  // Configurator wiring — typed names / chosen colors restitch live.
  useEffect(() => {
    if (!base?.live) return;
    const onLive = (e) => {
      const d = e?.detail || {};
      if (!cfgRef.current) return;
      if (typeof d.text === "string") cfgRef.current.text = d.text.trim() || base.text;
      if (typeof d.thread === "string" && d.thread) { cfgRef.current.thread = d.thread; setThread(d.thread); }
      post("fast");
    };
    window.addEventListener("stitch3d:live", onLive);
    return () => window.removeEventListener("stitch3d:live", onLive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  if (!base) return null;

  const pickThread = (hex) => {
    setThread(hex);
    cfgRef.current.thread = hex;
    post("slow");
  };

  return (
    <section ref={hostRef} className={`mt-16 lg:mt-24 pt-12 lg:pt-16 ${className}`} style={{ borderTop: "1px solid var(--border-default)" }}>
      <div className="max-w-3xl mb-6 lg:mb-8">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>
          {t("stitch3d.eyebrow")}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl mb-3 leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          {t("stitch3d.titlePre")}<em style={{ fontWeight: 400 }}>{t("stitch3d.titleEm")}</em>{t("stitch3d.titlePost")}
        </h2>
        <p className="text-sm lg:text-base opacity-75 leading-relaxed">
          {t("stitch3d.body")}
        </p>
      </div>

      <div
        className="relative overflow-hidden"
        style={{ borderRadius: 22, border: "1px solid var(--border-default)", aspectRatio: "16 / 10", maxHeight: 460, background: "radial-gradient(120% 90% at 50% 20%, #efece3 0%, #ddd7c8 55%, #c2bba9 100%)" }}
      >
        {nearViewport && (
          <iframe
            ref={iframeRef}
            src="/embroidery/stage.html?bg=light"
            title={t("stitch3d.eyebrow")}
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        )}
        {!frameReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs tracking-[0.25em] uppercase opacity-60">Live 3D</span>
          </div>
        )}
        <span
          className="absolute left-4 bottom-3 text-[11px] font-semibold px-3 py-1.5 pointer-events-none"
          style={{ background: "rgba(28,33,48,0.78)", color: "#fff", borderRadius: 999 }}
        >
          {t("stitch3d.hint")}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70">{t("stitch3d.threadLabel")}</span>
          <div className="flex gap-2">
            {STITCH_THREADS.map(([name, hex]) => (
              <button
                key={hex}
                type="button"
                title={name}
                aria-label={`${t("stitch3d.threadLabel")}: ${name}`}
                aria-pressed={thread === hex}
                onClick={() => pickThread(hex)}
                className="rounded-full"
                style={{
                  width: 28, height: 28, background: hex, cursor: "pointer",
                  border: "2px solid #fff",
                  boxShadow: thread === hex ? "0 0 0 3px var(--accent)" : "0 0 0 1px var(--border-strong)",
                }}
              />
            ))}
          </div>
        </div>
        <a
          href="/embroidery/"
          className="text-[0.65rem] tracking-[0.2em] uppercase underline-offset-4 hover:underline"
          style={{ color: "var(--accent-text)", fontWeight: 500 }}
        >
          {t("stitch3d.studioLink")} →
        </a>
      </div>
    </section>
  );
}
