// ============================================================
// HeartBurst — add-to-cart feedback animation
// ============================================================
// Spawns 7 heart particles that drift up + outward from the
// click point, briefly visible. Triggered on add-to-cart.
// `prefers-reduced-motion` is honored by the `.heart-particle`
// CSS rule in the global stylesheet (currently in index.html's
// inline <style>, migrates to src/styles/index.css at Phase 9).
//
// Props:
//   x, y — viewport coordinates of the click that triggered the
//          burst. The component renders fixed-positioned and
//          uses these to anchor the pivot div.
//
// MIRRORED FROM index.html (~line 6540).
// ============================================================

import React, { useState } from "react";

export function HeartBurst({ x, y }) {
  const [hearts] = useState(() =>
    Array.from({ length: 7 }, (_, i) => ({
      id: i,
      tx: (Math.random() - 0.5) * 180,           // -90 to +90 px horizontal travel
      ty: -70 - Math.random() * 90,              // -70 to -160 px vertical (upward)
      rot: (Math.random() - 0.5) * 70,           // -35 to +35 deg
      delay: Math.random() * 90,                 // 0–90 ms stagger
      // Mostly gold, with one in three trending warm-red — matches site palette.
      color: i % 3 === 0 ? "#8B2C2C" : "#B08842",
    }))
  );

  return (
    <div className="heart-burst-pivot" style={{ left: x, top: y }} aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="heart-particle"
          style={{
            color: h.color,
            "--tx": `${h.tx}px`,
            "--ty": `${h.ty}px`,
            "--rot": `${h.rot}deg`,
            animationDelay: `${h.delay}ms`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
