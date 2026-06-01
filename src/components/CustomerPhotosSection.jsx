// ============================================================
// CustomerPhotosSection — social-proof gallery
// ============================================================
// Photos of finished pieces in customers' homes. Sourced from
// customers who ticked the social-share consent box at checkout
// and either tagged us on Instagram/TikTok or emailed Lusik a
// photo. The section is intentionally separate from the
// testimonials block (text) — both work together to land "real
// people, real homes."
//
// The array below is the data source. When empty (or every entry
// is a TODO_LUSIK placeholder), the whole section is hidden, so
// the site doesn't show a row of broken-image icons at launch.
// As Lusik gathers real photos:
//   1. Drop the image into /img/customer-photos/.
//   2. Add an entry below with src, alt (describe the scene for
//      screen readers), handle (with the @), city, and the
//      consentedAt date she captured the permission on.
//   3. Deploy.
//
// MIRRORED FROM index.html (~line 3782). Co-located data with
// component for the same reason TestimonialsSection does.
// ============================================================

import React from "react";
import Image from "next/image";

const CUSTOMER_PHOTOS = [
  // ⚠️ TODO_LUSIK: replace these with real customer photos once
  // Lusik has at least 3 she's gathered explicit permission for.
  // src: "/img/customer-photos/anna-glendale.jpg",
  // alt: "Armenian alphabet blanket folded over a wooden crib rail in a sunlit nursery",
  // handle: "@anna_g",
  // city: "Glendale, CA",
  // consentedAt: "2026-01-14",
];

export function CustomerPhotosSection() {
  // Hide the whole section if there's nothing real to show. A row
  // of broken image icons is worse than no section at all.
  const photos = CUSTOMER_PHOTOS.filter((p) => p && typeof p.src === "string" && p.src.length > 0);
  if (photos.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
      <div className="text-center mb-10 lg:mb-14 max-w-xl mx-auto">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>From customer homes</p>
        <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          Where they <em style={{ fontWeight: 400 }}>landed</em>.
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {photos.map((p, i) => (
          <figure key={i} className="relative group overflow-hidden" style={{ background: "var(--bg-subtle)", aspectRatio: "4 / 5" }}>
            <Image
              src={p.src}
              alt={p.alt || `Finished piece in a customer's home`}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            {(p.handle || p.city) && (
              <figcaption className="absolute inset-x-0 bottom-0 p-2 lg:p-3 text-[0.65rem] tracking-[0.15em] uppercase" style={{
                color: "#F5EFE3",
                background: "linear-gradient(to top, rgba(26,22,18,0.7) 0%, rgba(26,22,18,0) 100%)",
              }}>
                {p.handle && <span style={{ fontWeight: 500 }}>{p.handle}</span>}
                {p.handle && p.city && <span className="opacity-80"> · </span>}
                {p.city && <span className="opacity-90">{p.city}</span>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <p className="text-center text-xs opacity-65 mt-8 leading-relaxed">
        Tag <span style={{ fontWeight: 500, color: "var(--accent)" }}>#lusikandsons</span> or send us a photo on Instagram — with your permission, we'd love to share it here.
      </p>
    </section>
  );
}
