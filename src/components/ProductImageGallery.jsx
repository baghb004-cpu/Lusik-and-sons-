// ============================================================
// ProductImageGallery — showcase-style gallery + color filter
// ============================================================
// Visual continuity with ProductShowcase's photo gallery (the
// live Armenian Alphabet Blanket page). Same DOM shape:
//
//   - Large main image (aspect-[4/5]) with:
//       • Tap to open a fullscreen lightbox
//       • Prev / Next chevron buttons on the sides
//       • "TAP TO ZOOM" badge in the bottom-left corner
//       • "n / total" counter in the bottom-right corner
//   - Thumbnail grid (6 cols) directly below the main image
//       • Active thumbnail outlined in ink, inactive ones at
//         opacity 50% (hover to 100%)
//   - Color swatch row below the thumbnails (optional)
//
// Behaviour:
//   - Auto-advance is OFF here (different intent from the
//     marketing slideshow on the home page — this is a product
//     browser, the customer drives navigation themselves).
//   - Color swatches act as filters. Clicking a swatch narrows
//     the visible photos to just that color and jumps to the
//     first one. Clicking the active swatch again clears the
//     filter (returns to all photos).
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "./icons.jsx";

export function ProductImageGallery({
  images,
  colorways,                  // optional
  alt = "Product photo",
}) {
  // null = no color filter active; otherwise an index into colorways[]
  const [activeColorway, setActiveColorway] = useState(null);
  // Index into the FILTERED visible list, not the raw images array.
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const containerRef = useRef(null);
  const thumbStripRef = useRef(null);

  const visibleIndices = activeColorway == null || !colorways
    ? images.map((_, i) => i)
    : colorways[activeColorway].indices;

  const count = visibleIndices.length;
  const safeIdx = activeIdx >= count ? 0 : activeIdx;
  const rawIdx = visibleIndices[safeIdx];
  const currentSrc = images[rawIdx];

  // When the active slide changes, keep the matching thumbnail
  // scrolled into view inside the thumbnail strip — without
  // scrolling the page itself. We compute the offset manually
  // (rather than using element.scrollIntoView) because the latter
  // can scroll ancestor containers including the document body.
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const thumb = strip.querySelector(`[data-thumb-idx="${safeIdx}"]`);
    if (!(thumb instanceof HTMLElement)) return;
    const stripRect = strip.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    // Center the thumb in the strip's visible window.
    const target = thumb.offsetLeft - (stripRect.width - thumbRect.width) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [safeIdx, count]);

  // Preload the neighbours so prev / next clicks feel instant.
  // The current src is rendered as an <img> already, so the
  // browser will cache it after first load; we only need to
  // hint the next ones.
  useEffect(() => {
    if (typeof window === "undefined" || count < 2) return;
    const next = visibleIndices[(safeIdx + 1) % count];
    const prev = visibleIndices[(safeIdx - 1 + count) % count];
    [next, prev].forEach((i) => {
      const img = new window.Image();
      img.src = images[i];
    });
  }, [safeIdx, count, visibleIndices, images]);

  // Keyboard navigation when the gallery container has focus.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || count < 2) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "Escape" && zoomOpen) { e.preventDefault(); setZoomOpen(false); }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [count, zoomOpen]);

  // Escape closes the lightbox even when focus isn't on the gallery.
  useEffect(() => {
    if (!zoomOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setZoomOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomOpen]);

  const goPrev = () => setActiveIdx((p) => (p - 1 + count) % count);
  const goNext = () => setActiveIdx((p) => (p + 1) % count);

  // Toggle a colorway. Clicking the active one again clears the
  // filter and returns to all photos.
  const toggleColorway = (idx) => {
    if (activeColorway === idx) {
      setActiveColorway(null);
    } else {
      setActiveColorway(idx);
    }
    setActiveIdx(0);
  };

  if (!images || images.length === 0) return null;

  return (
    // min-w-0 and overflow-x-hidden defend against children pushing
    // the gallery wider than its grid cell. The thumbnail strip +
    // swatch row both have their own overflow-x-auto for internal
    // horizontal scrolling, but without min-w-0 here, the grid
    // cell would expand to fit them. max-w-full is belt-and-braces.
    <div
      ref={containerRef}
      tabIndex={0}
      className="focus:outline-none min-w-0 max-w-full w-full overflow-x-hidden"
    >
      {/* MAIN IMAGE — tap to zoom, chevron buttons on the sides,
          TAP TO ZOOM badge bottom-left, counter bottom-right.
          Mirrors ProductShowcase line-for-line so the customer
          gets the same handle whether they're looking at the
          Armenian Alphabet Blanket or this Cotton Yarn Blanket. */}
      <div
        className="relative aspect-[4/5] overflow-hidden mb-4"
        style={{ background: "rgba(26,22,18,0.04)" }}
      >
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="absolute inset-0 w-full h-full block"
          aria-label={`Zoom photo ${safeIdx + 1} of ${count}`}
          style={{ cursor: "zoom-in", padding: 0, border: 0, background: "transparent" }}
        >
          <img
            key={currentSrc}
            src={currentSrc}
            alt={alt}
            // object-contain (not object-cover) so the entire photo
            // is visible inside the 4:5 portrait container. With
            // object-cover, landscape photos like the cotton blanket
            // stack got ~33% horizontally cropped on mobile and the
            // customer saw only a thin slice of abstract fabric
            // texture instead of the full product. Letterbox bars
            // (when an image's aspect doesn't match 4:5) blend into
            // the cream container background and are barely visible.
            className="w-full h-full object-contain pointer-events-none fade-in"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </button>
        {count > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center backdrop-blur-sm z-10"
              style={{ background: "rgba(245,239,227,0.6)" }}
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center backdrop-blur-sm z-10"
              style={{ background: "rgba(245,239,227,0.6)" }}
              aria-label="Next photo"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
        <div
          className="absolute bottom-3 right-3 px-3 py-1 text-xs tracking-wide pointer-events-none"
          style={{ background: "rgba(26,22,18,0.7)", color: "#F5EFE3" }}
        >
          {safeIdx + 1} / {count}
        </div>
        <div
          className="absolute bottom-3 left-3 px-2.5 py-1 text-[0.6rem] tracking-[0.15em] uppercase pointer-events-none flex items-center gap-1.5"
          style={{ background: "rgba(26,22,18,0.6)", color: "#F5EFE3" }}
        >
          <ZoomIn size={11} strokeWidth={2} /> Tap to zoom
        </div>
      </div>

      {/* THUMBNAIL STRIP — single horizontal row, scrolls
          horizontally for long galleries. Was a wrapping 6-col
          grid; with 61 photos that pushed the color picker far
          below the fold. A single scrollable row keeps the
          picker visible no matter how many photos are in the
          set. The active thumb scrolls into view automatically
          when the customer paginates with the chevron buttons. */}
      <div
        ref={thumbStripRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "thin" }}
        role="tablist"
        aria-label="Photo thumbnails"
      >
        {visibleIndices.map((rawI, vi) => (
          <button
            key={rawI}
            type="button"
            role="tab"
            data-thumb-idx={vi}
            onClick={() => setActiveIdx(vi)}
            className={`shrink-0 aspect-square overflow-hidden ${vi === safeIdx ? "" : "opacity-50 hover:opacity-100"}`}
            style={{
              width: "16%",
              minWidth: "64px",
              maxWidth: "92px",
              outline: vi === safeIdx ? "1.5px solid #1A1612" : "none",
              outlineOffset: "1px",
              scrollSnapAlign: "start",
            }}
            aria-label={`View photo ${vi + 1}`}
            aria-selected={vi === safeIdx}
          >
            <img
              src={images[rawI]}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>

      {/* COLOR SWATCHES — actual sellable colorways only. The
          previous "All / The family / In the studio" entries were
          dropped per product feedback: the customer is buying a
          color, not a "family" or "studio shot". To clear a filter,
          tap the active swatch again. */}
      {colorways && colorways.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase" style={{ color: "#B08842", fontWeight: 600 }}>
              Available colorways
            </p>
            {activeColorway != null && (
              <button
                type="button"
                onClick={() => { setActiveColorway(null); setActiveIdx(0); }}
                className="text-[0.65rem] tracking-[0.05em] underline underline-offset-2 hover:opacity-70"
                style={{ color: "#3D332A" }}
              >
                Show all photos
              </button>
            )}
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
            role="radiogroup"
            aria-label="Filter by color"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {colorways.map((cw, i) => (
              <ColorSwatch
                key={cw.label}
                label={cw.label}
                swatch={cw.swatch}
                active={activeColorway === i}
                onClick={() => toggleColorway(i)}
                count={cw.indices.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* FULLSCREEN ZOOM LIGHTBOX — opens when the main image is
          tapped. Click anywhere (or X / Escape) to close. Arrow
          buttons paginate within the same filtered set. */}
      {zoomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed photo"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(26, 22, 18, 0.92)" }}
          onClick={() => setZoomOpen(false)}
        >
          <img
            src={currentSrc}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            style={{ padding: "3rem 1rem" }}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }}
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center"
            style={{
              background: "rgba(245, 239, 227, 0.15)",
              border: "1px solid rgba(245, 239, 227, 0.3)",
              color: "#F5EFE3",
              borderRadius: "999px",
            }}
            aria-label="Close zoom"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center"
                style={{
                  background: "rgba(245, 239, 227, 0.15)",
                  border: "1px solid rgba(245, 239, 227, 0.3)",
                  color: "#F5EFE3",
                  borderRadius: "999px",
                }}
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center"
                style={{
                  background: "rgba(245, 239, 227, 0.15)",
                  border: "1px solid rgba(245, 239, 227, 0.3)",
                  color: "#F5EFE3",
                  borderRadius: "999px",
                }}
                aria-label="Next photo"
              >
                <ChevronRight size={24} strokeWidth={1.75} />
              </button>
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 text-xs tracking-wide pointer-events-none"
                style={{ background: "rgba(245, 239, 227, 0.15)", color: "#F5EFE3" }}
              >
                {safeIdx + 1} / {count}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ColorSwatch — one button in the color-picker row.
// ============================================================
function ColorSwatch({ label, swatch, active, onClick, count }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${label}, ${count} photo${count === 1 ? "" : "s"}${active ? " — currently selected, tap again to clear" : ""}`}
      onClick={onClick}
      className={`shrink-0 flex flex-col items-center gap-1.5 px-1 pt-1 transition-opacity ${active ? "opacity-100" : "opacity-75 hover:opacity-100"}`}
      style={{ scrollSnapAlign: "start" }}
    >
      <span
        className="block"
        style={{
          width: 44,
          height: 44,
          borderRadius: "999px",
          border: active ? "2px solid #B08842" : "1px solid rgba(26,22,18,0.2)",
          boxShadow: active
            ? "0 0 0 3px rgba(176, 136, 66, 0.2)"
            : "inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
          background: swatchBackground(swatch),
          transition: "box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      />
      <span
        className="text-[0.65rem] tracking-[0.05em] whitespace-nowrap"
        style={{
          color: active ? "#1A1612" : "#3D332A",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function swatchBackground(swatch) {
  if (!swatch) return "#F5EFE3";
  if (swatch.color)    return swatch.color;
  if (swatch.dual)     return `linear-gradient(135deg, ${swatch.dual[0]} 0%, ${swatch.dual[0]} 50%, ${swatch.dual[1]} 50%, ${swatch.dual[1]} 100%)`;
  if (swatch.gradient) return `conic-gradient(from 90deg, ${swatch.gradient.join(", ")}, ${swatch.gradient[0]})`;
  if (swatch.neutral)  return "linear-gradient(135deg, #E8DFD0 0%, #D6C9B4 100%)";
  return "#F5EFE3";
}
