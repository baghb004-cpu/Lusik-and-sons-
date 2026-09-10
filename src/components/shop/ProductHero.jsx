// ============================================================
// ProductHero — the photo band at the top of every live product page
// ============================================================
// Replaces the Embroidery Studio's iframed 3D "StageHero" (removed
// Sept 2026). Same box, same eyebrow / title / price treatment, so the
// page below it does not move: a full-width band on the classic page,
// a rounded inset card inside the immersive mobile sheet (`inline`).
//
// The 3D product engine planned in SITE_OVERHAUL_HANDOFF.md (Phase 1)
// mounts inside this component later; the photo becomes the poster it
// crossfades from. Keep the outer box stable when that lands.
//
// Accessibility: the title is a <p>, not a heading — the commerce card
// below owns the page's real <h1>, and a second heading broke the e2e
// suite's strict getByRole lookups once before.
// ============================================================
import React from "react";
import { useT } from "../../i18n/LangContext.jsx";

const GOLD = "#d4a94f";

export function ProductHero({ productKey, title, price, image, inline = false }) {
  const t = useT();
  return (
    <section
      aria-label={title}
      data-product-hero={productKey}
      className={inline ? "relative overflow-hidden mx-4 mt-4 mb-2" : "relative overflow-hidden w-full"}
      style={{
        borderRadius: inline ? 20 : 0,
        height: inline ? "46svh" : "min(66svh, 660px)",
        minHeight: inline ? 320 : 420,
        background: "#1a1612",
        border: inline ? "1px solid rgba(255,255,255,0.08)" : "none",
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "50% 45%" }}
        />
      ) : null}
      {/* soft ink gradient so the title reads on any photo */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(26,22,18,0.8) 0%, rgba(26,22,18,0.3) 42%, rgba(26,22,18,0) 68%)" }}
      />
      <div className="absolute left-5 bottom-5 lg:left-10 lg:bottom-9 z-10" style={{ maxWidth: "min(82%, 640px)" }}>
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>
          {t("productHero.eyebrow")}
        </p>
        <p
          className="font-display leading-tight"
          style={{ color: "#f5efe3", fontWeight: 400, letterSpacing: "-0.01em", fontSize: "clamp(1.5rem, 3.2vw, 2.6rem)", textShadow: "0 2px 18px rgba(0,0,0,0.55)", textWrap: "balance" }}
        >
          {title}
        </p>
        {price != null && (
          <span className="inline-block mt-3 px-4 py-1.5 text-sm" style={{ background: GOLD, color: "#161207", borderRadius: 999, fontWeight: 600 }}>
            {price}
          </span>
        )}
      </div>
    </section>
  );
}
