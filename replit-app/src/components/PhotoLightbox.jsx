// ============================================================
// PhotoLightbox — full-photo viewer (Chunk 2 placeholder)
// ============================================================
// The see-the-corners view behind the immersive page's photo-tap
// contract. THIS VERSION is the Chunk-2 placeholder: full-bleed
// object-contain photos, sideways paging, counter, ✕ / Escape close.
// Chunk 3 replaces the internals with the zoomable machine (pinch
// 1×–4×, double-tap, pan clamping, pull-down-to-close) —
// PhotoViewer.swift parity.

import React, { useEffect, useRef, useState } from "react";

export function PhotoLightbox({ photos, title, startIndex = 0, onClose }) {
  const pagerRef = useRef(null);
  const [index, setIndex] = useState(startIndex);

  // Land on the photo that was tapped.
  useEffect(() => {
    const el = pagerRef.current;
    if (el) el.scrollTo({ left: startIndex * el.clientWidth, behavior: "instant" });
  }, [startIndex]);

  const onScroll = () => {
    const el = pagerRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(index); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose]);

  return (
    <div className="lightbox" role="dialog" aria-label={`${title} photo viewer`}>
      <div className="lightbox-pager" ref={pagerRef} onScroll={onScroll}>
        {photos.map((src, i) => (
          <div key={i} className="lightbox-slide">
            <img src={src} alt={`${title} — photo ${i + 1}`} draggable={false} />
          </div>
        ))}
      </div>
      <button type="button" className="lightbox-close" onClick={() => onClose(index)} aria-label="Close photo viewer">
        ✕
      </button>
      <div className="lightbox-counter">{index + 1} / {photos.length}</div>
    </div>
  );
}
