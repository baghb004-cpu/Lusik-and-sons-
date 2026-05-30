"use client";

// ============================================================
// CategoryCardImage — hover/auto-cycle image for category cards
// ============================================================
// Used on the Featured Categories strip on the home page. A
// category card can pass a single image (static, no behavior)
// OR an array of images representing the products inside that
// category — the component then cycles through them so the
// customer gets a preview of what lives behind the card.
//
// Cycle behaviour, by input device:
//
//   - Hover-capable (desktop with mouse): static on the first
//     image; cycles only while the mouse is on the card. Faster
//     cycle (1500ms) because the user is actively engaged. On
//     mouseleave, resets to image 0.
//
//   - Touch (phone / tablet): the customer can't hover. Auto-
//     cycles continuously every 4000ms so a user scrolling
//     down the home page still sees both products in the
//     category. Slower cycle keeps it from feeling busy.
//
//   - prefers-reduced-motion: stays on image 0, no cycling.
//
// Two images sit stacked at the same absolute position with
// opacity transitions for the crossfade. We use eager-load
// (not lazy) because there are at most 2-3 images per card,
// they're above the fold, and we want zero stutter on the
// first hover.
// ============================================================

import React, { useEffect, useRef, useState } from "react";

const DESKTOP_INTERVAL_MS = 1500;
const TOUCH_INTERVAL_MS   = 4000;
const FADE_MS             = 700;

export function CategoryCardImage({ images, alt = "", className = "" }) {
  // Normalize — accept a single string OR an array.
  const list = Array.isArray(images) ? images : (images ? [images] : []);
  const [idx, setIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [supportsHover, setSupportsHover] = useState(true); // assume desktop until proven otherwise
  const [prefersReduced, setPrefersReduced] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const hover = window.matchMedia("(hover: hover)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateHover = () => setSupportsHover(hover.matches);
    const updateMotion = () => setPrefersReduced(motion.matches);
    updateHover();
    updateMotion();
    hover.addEventListener?.("change", updateHover);
    motion.addEventListener?.("change", updateMotion);
    return () => {
      hover.removeEventListener?.("change", updateHover);
      motion.removeEventListener?.("change", updateMotion);
    };
  }, []);

  // Cycle effect. Runs on hover (desktop), continuously (touch),
  // or never (reduced-motion / single-image case).
  useEffect(() => {
    if (list.length < 2) return undefined;
    if (prefersReduced) return undefined;

    const active = supportsHover ? hovering : true;

    if (!active) {
      // Desktop without hover: reset to first image when mouse
      // leaves so a customer who hovered, saw image 2, then
      // moused away doesn't see image 2 frozen on the card.
      if (supportsHover && idx !== 0) {
        // Defer the reset so the in-flight crossfade can finish.
        const t = setTimeout(() => setIdx(0), FADE_MS);
        return () => clearTimeout(t);
      }
      return undefined;
    }

    const ms = supportsHover ? DESKTOP_INTERVAL_MS : TOUCH_INTERVAL_MS;
    intervalRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % list.length);
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [supportsHover, hovering, prefersReduced, list.length, idx]);

  if (list.length === 0) return null;

  // Single-image case — no behavior, no stacking, just render.
  if (list.length === 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  // Multi-image case — stack absolutely, crossfade between them.
  return (
    <div
      className={`relative w-full h-full ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {list.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ""}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: i === idx ? 1 : 0,
            transition: prefersReduced ? "none" : `opacity ${FADE_MS}ms ease-in-out`,
          }}
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : "low"}
          decoding="async"
          aria-hidden={i !== idx}
        />
      ))}
    </div>
  );
}
