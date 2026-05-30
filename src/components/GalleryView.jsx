"use client";

// ============================================================
// GalleryView — full archive of Lusik's work (388 photos)
// ============================================================
// Browse every photo in the archive. Photos with descriptive
// names get auto-categorized; the rest live in the "Archive"
// filter, ready to be moved into a proper category as content
// gets reviewed.
//
// Photos served from /img/gallery/<filename>. Filename is
// "<category>__<index>.jpg" — the prefix before "__" is the
// filter chip. New photos added later just need to follow the
// same naming convention to appear in the right filter.
//
// Performance:
//   * All images use loading="lazy" — browser fetches only as
//     they scroll into view. With 388 entries, this matters.
//   * IntersectionObserver-based "load 50 at a time" pattern
//     is overkill for this size — native lazy is enough.
//   * Click on any photo opens a simple inline lightbox.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";

// The full list of photo filenames in /img/gallery/. Generated
// from the source archive — see SLIDESHOW_PHOTOS_PROCESSING.md.
const GALLERY_FILES = ["bathrobe-sets__372.jpg","bathrobe-sets__373.jpg","bathrobe-sets__374.jpg","bathrobe-sets__375.jpg","beaded-crosses__314.jpg","bib-burp-sets__376.jpg","bib-burp-sets__377.jpg","bib-hat-sets__378.jpg","bib-hat-sets__379.jpg","bib-sets__312.jpg","bib-sets__313.jpg","bib-sets__380.jpg","bib-sets__381.jpg","bib-sets__382.jpg","crib-blankets__370.jpg","days-of-week__371.jpg","giraffe-rattles__368.jpg","giraffe-rattles__369.jpg","throw-blankets__383.jpg","throw-blankets__384.jpg","throw-blankets__385.jpg","throw-blankets__386.jpg","throw-blankets__387.jpg","uncategorized__000.jpg","uncategorized__001.jpg","uncategorized__002.jpg","uncategorized__003.jpg","uncategorized__004.jpg","uncategorized__005.jpg","uncategorized__006.jpg","uncategorized__007.jpg","uncategorized__008.jpg","uncategorized__009.jpg","uncategorized__010.jpg","uncategorized__011.jpg","uncategorized__012.jpg","uncategorized__013.jpg","uncategorized__014.jpg","uncategorized__015.jpg","uncategorized__016.jpg","uncategorized__017.jpg","uncategorized__018.jpg","uncategorized__019.jpg","uncategorized__020.jpg","uncategorized__021.jpg","uncategorized__022.jpg","uncategorized__023.jpg","uncategorized__024.jpg","uncategorized__025.jpg","uncategorized__026.jpg","uncategorized__027.jpg","uncategorized__028.jpg","uncategorized__029.jpg","uncategorized__030.jpg","uncategorized__031.jpg","uncategorized__032.jpg","uncategorized__033.jpg","uncategorized__034.jpg","uncategorized__035.jpg","uncategorized__036.jpg","uncategorized__037.jpg","uncategorized__038.jpg","uncategorized__039.jpg","uncategorized__040.jpg","uncategorized__041.jpg","uncategorized__042.jpg","uncategorized__043.jpg","uncategorized__044.jpg","uncategorized__045.jpg","uncategorized__046.jpg","uncategorized__047.jpg","uncategorized__048.jpg","uncategorized__049.jpg","uncategorized__050.jpg","uncategorized__051.jpg","uncategorized__052.jpg","uncategorized__053.jpg","uncategorized__054.jpg","uncategorized__055.jpg","uncategorized__056.jpg","uncategorized__057.jpg","uncategorized__058.jpg","uncategorized__059.jpg","uncategorized__060.jpg","uncategorized__061.jpg","uncategorized__062.jpg","uncategorized__063.jpg","uncategorized__064.jpg","uncategorized__065.jpg","uncategorized__066.jpg","uncategorized__067.jpg","uncategorized__068.jpg","uncategorized__069.jpg","uncategorized__070.jpg","uncategorized__071.jpg","uncategorized__072.jpg","uncategorized__073.jpg","uncategorized__074.jpg","uncategorized__075.jpg","uncategorized__076.jpg","uncategorized__077.jpg","uncategorized__078.jpg","uncategorized__079.jpg","uncategorized__080.jpg","uncategorized__081.jpg","uncategorized__082.jpg","uncategorized__083.jpg","uncategorized__084.jpg","uncategorized__085.jpg","uncategorized__086.jpg","uncategorized__087.jpg","uncategorized__088.jpg","uncategorized__089.jpg","uncategorized__090.jpg","uncategorized__091.jpg","uncategorized__092.jpg","uncategorized__093.jpg","uncategorized__094.jpg","uncategorized__095.jpg","uncategorized__096.jpg","uncategorized__097.jpg","uncategorized__098.jpg","uncategorized__099.jpg","uncategorized__100.jpg","uncategorized__101.jpg","uncategorized__102.jpg","uncategorized__103.jpg","uncategorized__104.jpg","uncategorized__105.jpg","uncategorized__106.jpg","uncategorized__107.jpg","uncategorized__108.jpg","uncategorized__109.jpg","uncategorized__110.jpg","uncategorized__111.jpg","uncategorized__112.jpg","uncategorized__113.jpg","uncategorized__114.jpg","uncategorized__115.jpg","uncategorized__116.jpg","uncategorized__117.jpg","uncategorized__118.jpg","uncategorized__119.jpg","uncategorized__120.jpg","uncategorized__121.jpg","uncategorized__122.jpg","uncategorized__123.jpg","uncategorized__124.jpg","uncategorized__125.jpg","uncategorized__126.jpg","uncategorized__127.jpg","uncategorized__128.jpg","uncategorized__129.jpg","uncategorized__130.jpg","uncategorized__131.jpg","uncategorized__132.jpg","uncategorized__133.jpg","uncategorized__134.jpg","uncategorized__135.jpg","uncategorized__136.jpg","uncategorized__137.jpg","uncategorized__138.jpg","uncategorized__139.jpg","uncategorized__140.jpg","uncategorized__141.jpg","uncategorized__142.jpg","uncategorized__143.jpg","uncategorized__144.jpg","uncategorized__145.jpg","uncategorized__146.jpg","uncategorized__147.jpg","uncategorized__148.jpg","uncategorized__149.jpg","uncategorized__150.jpg","uncategorized__151.jpg","uncategorized__152.jpg","uncategorized__153.jpg","uncategorized__154.jpg","uncategorized__155.jpg","uncategorized__156.jpg","uncategorized__157.jpg","uncategorized__158.jpg","uncategorized__159.jpg","uncategorized__160.jpg","uncategorized__161.jpg","uncategorized__162.jpg","uncategorized__163.jpg","uncategorized__164.jpg","uncategorized__165.jpg","uncategorized__166.jpg","uncategorized__167.jpg","uncategorized__168.jpg","uncategorized__169.jpg","uncategorized__170.jpg","uncategorized__171.jpg","uncategorized__172.jpg","uncategorized__173.jpg","uncategorized__174.jpg","uncategorized__175.jpg","uncategorized__176.jpg","uncategorized__177.jpg","uncategorized__178.jpg","uncategorized__179.jpg","uncategorized__180.jpg","uncategorized__181.jpg","uncategorized__182.jpg","uncategorized__183.jpg","uncategorized__184.jpg","uncategorized__185.jpg","uncategorized__186.jpg","uncategorized__187.jpg","uncategorized__188.jpg","uncategorized__189.jpg","uncategorized__190.jpg","uncategorized__191.jpg","uncategorized__192.jpg","uncategorized__193.jpg","uncategorized__194.jpg","uncategorized__195.jpg","uncategorized__196.jpg","uncategorized__197.jpg","uncategorized__198.jpg","uncategorized__199.jpg","uncategorized__200.jpg","uncategorized__201.jpg","uncategorized__202.jpg","uncategorized__203.jpg","uncategorized__204.jpg","uncategorized__205.jpg","uncategorized__206.jpg","uncategorized__207.jpg","uncategorized__208.jpg","uncategorized__209.jpg","uncategorized__210.jpg","uncategorized__211.jpg","uncategorized__212.jpg","uncategorized__213.jpg","uncategorized__214.jpg","uncategorized__215.jpg","uncategorized__216.jpg","uncategorized__217.jpg","uncategorized__218.jpg","uncategorized__219.jpg","uncategorized__220.jpg","uncategorized__221.jpg","uncategorized__222.jpg","uncategorized__223.jpg","uncategorized__224.jpg","uncategorized__225.jpg","uncategorized__226.jpg","uncategorized__227.jpg","uncategorized__228.jpg","uncategorized__229.jpg","uncategorized__230.jpg","uncategorized__231.jpg","uncategorized__232.jpg","uncategorized__233.jpg","uncategorized__234.jpg","uncategorized__235.jpg","uncategorized__236.jpg","uncategorized__237.jpg","uncategorized__238.jpg","uncategorized__239.jpg","uncategorized__240.jpg","uncategorized__241.jpg","uncategorized__242.jpg","uncategorized__243.jpg","uncategorized__244.jpg","uncategorized__245.jpg","uncategorized__246.jpg","uncategorized__247.jpg","uncategorized__248.jpg","uncategorized__249.jpg","uncategorized__250.jpg","uncategorized__251.jpg","uncategorized__252.jpg","uncategorized__253.jpg","uncategorized__254.jpg","uncategorized__255.jpg","uncategorized__256.jpg","uncategorized__257.jpg","uncategorized__258.jpg","uncategorized__259.jpg","uncategorized__260.jpg","uncategorized__261.jpg","uncategorized__262.jpg","uncategorized__263.jpg","uncategorized__264.jpg","uncategorized__265.jpg","uncategorized__266.jpg","uncategorized__267.jpg","uncategorized__268.jpg","uncategorized__269.jpg","uncategorized__270.jpg","uncategorized__271.jpg","uncategorized__272.jpg","uncategorized__273.jpg","uncategorized__274.jpg","uncategorized__275.jpg","uncategorized__276.jpg","uncategorized__277.jpg","uncategorized__278.jpg","uncategorized__279.jpg","uncategorized__280.jpg","uncategorized__281.jpg","uncategorized__282.jpg","uncategorized__283.jpg","uncategorized__284.jpg","uncategorized__285.jpg","uncategorized__286.jpg","uncategorized__287.jpg","uncategorized__288.jpg","uncategorized__289.jpg","uncategorized__290.jpg","uncategorized__291.jpg","uncategorized__292.jpg","uncategorized__293.jpg","uncategorized__294.jpg","uncategorized__295.jpg","uncategorized__296.jpg","uncategorized__297.jpg","uncategorized__298.jpg","uncategorized__299.jpg","uncategorized__300.jpg","uncategorized__301.jpg","uncategorized__302.jpg","uncategorized__303.jpg","uncategorized__304.jpg","uncategorized__305.jpg","uncategorized__306.jpg","uncategorized__307.jpg","uncategorized__308.jpg","uncategorized__309.jpg","uncategorized__310.jpg","uncategorized__311.jpg","uncategorized__315.jpg","uncategorized__316.jpg","uncategorized__317.jpg","uncategorized__318.jpg","uncategorized__319.jpg","uncategorized__320.jpg","uncategorized__321.jpg","uncategorized__322.jpg","uncategorized__323.jpg","uncategorized__324.jpg","uncategorized__325.jpg","uncategorized__326.jpg","uncategorized__327.jpg","uncategorized__328.jpg","uncategorized__329.jpg","uncategorized__330.jpg","uncategorized__331.jpg","uncategorized__332.jpg","uncategorized__333.jpg","uncategorized__334.jpg","uncategorized__335.jpg","uncategorized__336.jpg","uncategorized__337.jpg","uncategorized__338.jpg","uncategorized__339.jpg","uncategorized__340.jpg","uncategorized__341.jpg","uncategorized__342.jpg","uncategorized__343.jpg","uncategorized__344.jpg","uncategorized__345.jpg","uncategorized__346.jpg","uncategorized__347.jpg","uncategorized__348.jpg","uncategorized__349.jpg","uncategorized__350.jpg","uncategorized__351.jpg","uncategorized__352.jpg","uncategorized__353.jpg","uncategorized__354.jpg","uncategorized__355.jpg","uncategorized__356.jpg","uncategorized__357.jpg","uncategorized__358.jpg","uncategorized__359.jpg","uncategorized__360.jpg","uncategorized__361.jpg","uncategorized__362.jpg","uncategorized__363.jpg","uncategorized__364.jpg","uncategorized__365.jpg","uncategorized__366.jpg","uncategorized__367.jpg"];

// Maps a raw category prefix to a broader UI group + nice label.
function groupFor(rawCat) {
  if (rawCat === "crib-blankets" || rawCat === "throw-blankets") return { key: "blankets", label: "Blankets" };
  if (rawCat === "bib-sets" || rawCat === "bib-burp-sets" || rawCat === "bib-hat-sets" || rawCat === "days-of-week") return { key: "bibs", label: "Bibs" };
  if (rawCat === "bathrobe-sets") return { key: "sets", label: "Sets" };
  if (rawCat === "giraffe-rattles") return { key: "toys", label: "Toys" };
  if (rawCat === "beaded-crosses" || rawCat === "wall-art") return { key: "decor", label: "Wall & decor" };
  return { key: "archive", label: "Archive" };
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "blankets", label: "Blankets" },
  { key: "bibs", label: "Bibs" },
  { key: "sets", label: "Sets" },
  { key: "toys", label: "Toys" },
  { key: "decor", label: "Wall & decor" },
  { key: "archive", label: "Archive" },
];

// Pre-compute the (filename, group) pairs once so re-render is cheap.
const PHOTOS = GALLERY_FILES.map((f) => {
  const rawCat = f.split("__")[0];
  return { src: `/img/gallery/${f}`, group: groupFor(rawCat).key, label: groupFor(rawCat).label };
});

export function GalleryView() {
  const [filter, setFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  const visible = useMemo(
    () => (filter === "all" ? PHOTOS : PHOTOS.filter((p) => p.group === filter)),
    [filter]
  );

  // Close lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const counts = useMemo(() => {
    const c = { all: PHOTOS.length };
    PHOTOS.forEach((p) => {
      c[p.group] = (c[p.group] || 0) + 1;
    });
    return c;
  }, []);

  return (
    <div className="fade-in">
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-20 pb-8">
        <p
          className="text-xs tracking-[0.3em] uppercase mb-4 text-center"
          style={{ color: "#B08842" }}
        >
          The archive
        </p>
        <h1
          className="font-display text-4xl lg:text-6xl mb-5 text-center"
          style={{ fontWeight: 400, letterSpacing: "-0.02em" }}
        >
          Every piece <em style={{ fontWeight: 400 }}>Lusik has made</em>.
        </h1>
        <p className="text-base lg:text-lg opacity-75 leading-relaxed text-center max-w-2xl mx-auto">
          A working archive of {PHOTOS.length} photographs of Lusik's hand cross-stitch and machine
          embroidery work, taken across many years in her Cypress, California studio. Browse by
          category, or just scroll.
        </p>
        <div className="gold-line mt-10 mb-12 max-w-xs mx-auto" />
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-20">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 lg:gap-3 justify-center mb-8 lg:mb-12">
          {FILTERS.map((f) => {
            const count = counts[f.key] || 0;
            if (count === 0 && f.key !== "all") return null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-4 py-2 text-sm border transition"
                style={{
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--text-on-ink)" : "#1A1612",
                  borderColor: active ? "var(--ink)" : "rgba(26,22,18,0.18)",
                }}
              >
                {f.label} <span className="opacity-60 ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3">
          {visible.map((p) => (
            <button
              key={p.src}
              onClick={() => setLightbox(p.src)}
              className="group aspect-square overflow-hidden bg-[rgba(176,136,66,0.04)]"
              aria-label={`Open ${p.label} photo`}
            >
              <img
                src={p.src}
                alt={`${p.label} — Lusik's archive`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="text-center opacity-60 py-12">No photos in this category yet.</p>
        )}
      </section>

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-12 cursor-zoom-out"
          style={{ background: "rgba(26,22,18,0.92)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <img
            src={lightbox}
            alt="Enlarged view"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 lg:top-8 lg:right-8 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="Close preview"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
