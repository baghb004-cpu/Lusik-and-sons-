// ============================================================
// StageHero — the studio's dark 3D stage as the PDP's opening act
// ============================================================
// The owner's brief: product pages should LOOK like the Embroidery
// Studio — the 3D model front and center, not a panel buried below
// the fold. This renders the studio's stage language as a full-width
// hero band at the top of every live product page: dark radial
// backdrop, gold eyebrow, the product name in stage typography, the
// live-3D stitch (same engine, iframed stage.html?bg=dark so Three.js
// stays out of the Next bundle), a thread-swatch strip, and — on the
// personalizable pieces — the name field right on the stage.
//
// Scroll safety: the 3D canvas consumes wheel/touch (that's how you
// spin it), so the iframe sleeps behind pointer-events:none until the
// shopper taps "Tap to spin it" — the embedded-map pattern. The stage
// idles with its own motion, so the hero looks alive either way.
//
// Two-way name sync on live products: typing here dispatches
//   stitch3d:live  → this hero's own stage restitches
//   stitch3d:hero  → the configurator below adopts the name
// and the configurator's own input dispatches stitch3d:live back
// (already wired), so both fields and the stage stay in agreement.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { STITCH_PREVIEWS, STITCH_THREADS } from "../../data/stitchPreviews.js";
import { useT } from "../../i18n/LangContext.jsx";

export function StageHero({ productKey, title, price, inline = false }) {
  const t = useT();
  const base = STITCH_PREVIEWS[productKey];
  const [frameReady, setFrameReady] = useState(false);
  const [thread, setThread] = useState(base?.thread);
  const [interactive, setInteractive] = useState(false);
  const [typed, setTyped] = useState("");
  const iframeRef = useRef(null);
  const cfgRef = useRef(base ? { ...base } : null);

  const post = (restitch = "slow") => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !cfgRef.current) return;
    win.postMessage({ type: "stitch", ...cfgRef.current, restitch }, "*");
  };

  useEffect(() => {
    if (!base) return;
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "stitch-ready") { setFrameReady(true); post("slow"); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // The configurator's own input feeds the stage too (live products).
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

  const onType = (value) => {
    setTyped(value);
    cfgRef.current.text = value.trim() || base.text;
    post("fast");
    window.dispatchEvent(new CustomEvent("stitch3d:hero", { detail: { text: value } }));
  };

  const pickThread = (hex) => {
    setThread(hex);
    cfgRef.current.thread = hex;
    post("slow");
    if (base.live) window.dispatchEvent(new CustomEvent("stitch3d:hero", { detail: { thread: hex } }));
  };

  const gold = "#d4a94f";
  const soft = "#9aa1b0";

  return (
    <section
      aria-label={t("stitch3d.eyebrow")}
      className={inline ? "relative overflow-hidden mx-4 mt-4 mb-2" : "relative overflow-hidden w-full"}
      style={{
        borderRadius: inline ? 20 : 0,
        height: inline ? "46svh" : "min(66svh, 660px)",
        minHeight: inline ? 320 : 420,
        background: "radial-gradient(ellipse 75% 65% at 50% 42%, #232838 0%, #151823 52%, #0b0d12 100%)",
        border: inline ? "1px solid rgba(255,255,255,0.08)" : "none",
      }}
    >
      <iframe
        ref={iframeRef}
        src="/embroidery/stage.html?bg=dark"
        title={t("stitch3d.eyebrow")}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", border: 0,
          pointerEvents: interactive ? "auto" : "none",
        }}
      />

      {/* name + price, stage typography */}
      <div className="absolute top-5 left-5 lg:top-8 lg:left-10 z-10 pointer-events-none" style={{ maxWidth: "min(70%, 640px)" }}>
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: gold }}>
          {t("stitch3d.eyebrow")}
        </p>
        {/* Visual title only — the commerce card below owns the page's real
            <h1>; a second heading here would duplicate the accessible name
            (and it broke the e2e suite's strict getByRole lookups). */}
        <p
          className="font-display leading-tight"
          style={{ color: "#eceef4", fontWeight: 400, letterSpacing: "-0.01em", fontSize: "clamp(1.5rem, 3.2vw, 2.6rem)", textShadow: "0 2px 18px rgba(0,0,0,0.65)", textWrap: "balance" }}
        >
          {title}
        </p>
        {price != null && (
          <span className="inline-block mt-3 px-4 py-1.5 text-sm" style={{ background: gold, color: "#161207", borderRadius: 999, fontWeight: 600 }}>
            {price}
          </span>
        )}
      </div>

      {/* interaction gate — the embedded-map pattern */}
      <button
        type="button"
        onClick={() => setInteractive((v) => !v)}
        className="absolute top-5 right-5 z-10 px-4 py-2 text-[11px] tracking-wide"
        style={{
          background: interactive ? gold : "rgba(10,12,17,0.72)",
          color: interactive ? "#161207" : soft,
          border: `1px solid ${interactive ? gold : "rgba(255,255,255,0.14)"}`,
          borderRadius: 999, fontWeight: 600, backdropFilter: "blur(6px)",
        }}
      >
        {interactive ? `✕ ${t("stitch3d.hint")}` : t("stitch3d.interact")}
      </button>

      {/* stage footer: swatches + (live) name input + studio link */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10 px-5 lg:px-10 py-4 flex items-center gap-4 flex-wrap"
        style={{ background: "linear-gradient(to top, rgba(8,10,14,0.82), rgba(8,10,14,0))" }}
      >
        <div className="flex items-center gap-2">
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
                width: 26, height: 26, background: hex, cursor: "pointer",
                border: "2px solid rgba(255,255,255,0.85)",
                boxShadow: thread === hex ? `0 0 0 3px ${gold}` : "0 0 0 1px rgba(0,0,0,0.4)",
              }}
            />
          ))}
        </div>

        {base.live && (
          <input
            type="text"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            placeholder={t("stitch3d.typePlaceholder")}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 text-sm"
            style={{
              background: "rgba(255,255,255,0.08)", color: "#eceef4",
              border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, outline: "none",
            }}
          />
        )}

        <a
          href="/embroidery/"
          className="ml-auto text-[0.62rem] tracking-[0.2em] uppercase hover:underline underline-offset-4"
          style={{ color: gold, fontWeight: 600 }}
        >
          {t("stitch3d.studioLink")} →
        </a>
      </div>

      {!frameReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs tracking-[0.3em] uppercase" style={{ color: soft }}>Live 3D</span>
        </div>
      )}
    </section>
  );
}
