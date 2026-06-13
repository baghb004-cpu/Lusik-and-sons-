// ============================================================
// Immersive Builder — scroll-story code generator (pure)
// ============================================================
// ScrollProject → a clean, offline, progressively-enhanced web page:
// index.html (real headings/text/links — works with NO JS), styles.css
// (reveal + parallax + CSS-3D, all disabled under prefers-reduced-motion),
// scroll.js (IntersectionObserver reveals, paused offscreen), plus docs.
// No external libraries, no CDN. Placeholder blocks where no image.
// ============================================================

import type { ScrollProject, Section } from "./schemas.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sectionHtml(s: Section): string {
  const cls = `reveal anim-${s.animation} sec-${s.type}`;
  const media = s.imageUrl
    ? `<img class="sec-img" src="${esc(s.imageUrl)}" alt="${esc(s.heading || "")}" loading="lazy" decoding="async">`
    : `<div class="sec-img placeholder" role="img" aria-label="${esc(s.heading || "image placeholder")}"></div>`;
  const heading = s.heading ? `<h2>${esc(s.heading)}</h2>` : "";
  const body = s.body ? `<p>${esc(s.body)}</p>` : "";
  const cta = s.ctaLabel ? `<a class="cta" href="${esc(s.ctaHref || "#")}">${esc(s.ctaLabel)}</a>` : "";
  const showImg = ["hero", "image-reveal", "product-card", "showcase"].includes(s.type);
  return `    <section class="${cls}" data-anim="${s.animation}" style="--accent:${esc(s.accent)}">
      <div class="inner">
        ${showImg ? media : ""}
        <div class="text">${heading}${body}${cta}</div>
      </div>
    </section>`;
}

function indexHtml(p: ScrollProject): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.name)}</title>
  <meta name="description" content="${esc(p.name)} — an interactive scroll experience.">
  <link rel="stylesheet" href="styles.css">
</head>
<body class="q-${p.quality}">
  <!-- Content is real HTML, so it reads fine even without JavaScript. -->
  <main>
${p.sections.map(sectionHtml).join("\n")}
  </main>
  <script src="scroll.js" defer></script>
</body>
</html>
`;
}

function stylesCss(p: ScrollProject): string {
  return `:root { --ink: #1A1612; --cream: #F5EFE3; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--cream); line-height: 1.5; }
main { width: 100%; }
section { min-height: 80vh; display: grid; place-items: center; padding: 12vh 6vw; }
.inner { max-width: 960px; width: 100%; display: grid; gap: 1.5rem; align-items: center; }
.sec-hero .inner, .sec-image-reveal .inner, .sec-product-card .inner, .sec-showcase .inner { grid-template-columns: 1fr; }
@media (min-width: 760px) {
  .sec-product-card .inner, .sec-showcase .inner { grid-template-columns: 1fr 1fr; }
}
h2 { font-size: clamp(1.6rem, 4vw, 2.6rem); margin: 0 0 .25em; }
p { font-size: clamp(1rem, 2.2vw, 1.2rem); max-width: 60ch; }
.sec-img { width: 100%; border-radius: 16px; display: block; aspect-ratio: 16 / 10; object-fit: cover; }
.placeholder { background: linear-gradient(135deg, var(--accent), #00000022); }
.cta { display: inline-block; margin-top: 1rem; background: var(--accent); color: #fff; padding: .7rem 1.4rem; border-radius: 999px; text-decoration: none; font-weight: 600; }

/* Progressive enhancement: only HIDE things once JS is running. */
html.js .reveal { opacity: 0; will-change: transform, opacity; transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); }
html.js .reveal.anim-slide-up { transform: translateY(40px); }
html.js .reveal.anim-slide-left { transform: translateX(40px); }
html.js .reveal.anim-scale { transform: scale(.92); }
html.js .reveal.anim-spin .sec-img { transition: transform 1.2s ease; transform: rotateY(35deg); }
html.js .reveal.in-view { opacity: 1; transform: none; }
html.js .reveal.in-view.anim-spin .sec-img { transform: rotateY(0deg); }
.anim-parallax .sec-img { transform: translateY(var(--py, 0)); }

/* Accessibility: anyone who prefers reduced motion sees content immediately. */
@media (prefers-reduced-motion: reduce) {
  html.js .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  .anim-parallax .sec-img { transform: none !important; }
}
`;
}

function scrollJs(p: ScrollProject): string {
  return `// ${p.name} — scroll enhancements (no libraries, offline).
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reduce || !("IntersectionObserver" in window)) {
    // Show everything; respect the user's motion preference.
    reveals.forEach(function (el) { el.classList.add("in-view"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } });
  }, { threshold: 0.2 });
  reveals.forEach(function (el) { io.observe(el); });

  // Light parallax only for in-view parallax sections (paused offscreen).
  var px = Array.prototype.slice.call(document.querySelectorAll('.anim-parallax'));
  if (px.length) {
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      px.forEach(function (sec) {
        var r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return; // offscreen: skip
        var img = sec.querySelector('.sec-img');
        if (img) { var offset = (r.top - vh / 2) * -0.06; img.style.setProperty('--py', offset.toFixed(1) + 'px'); }
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
})();
`;
}

const docs = {
  readme: (p: ScrollProject) => `# ${p.name}

An interactive scroll experience generated by **Creation Studio → Immersive Builder**.
It's a plain website folder — open \`index.html\` in any browser, or drop these files
into your website builder as a section.

- \`index.html\` — your content as real headings/text/links (works without JavaScript).
- \`styles.css\` — the look + the scroll/parallax/3D animations.
- \`scroll.js\` — reveals sections as you scroll (skipped for reduced-motion users).
- \`assets/\` — put your own optimized images here and update the \`src\` paths.

No libraries, no internet needed. See PERFORMANCE_NOTES.md and ACCESSIBILITY_NOTES.md.
`,
  licenses: () => `# Licenses

This generated page uses no third-party libraries. The code is yours to use and edit.

Assets: use only your own, open-source, or properly licensed images/video. Do not
include copyrighted characters, logos, music, or models without permission.
`,
  perf: (p: ScrollProject) => `# Performance notes

Quality tier: ${p.quality}. Mobile should stay on Lightweight/Balanced.

- Images are lazy-loaded; compress them (aim < 200 KB each) before shipping.
- Animations run only while a section is on screen, and pause offscreen.
- Parallax is subtle and disabled for reduced-motion users.
- One beautiful effect beats ten busy ones — keep the story short.
`,
  a11y: () => `# Accessibility notes

- All content is real HTML and readable with JavaScript OFF.
- Reduced-motion users (OS setting) see everything immediately — no animation.
- Headings, text, and links are standard tags; links/buttons work normally.
- Don't hide important text inside motion-only effects.
`,
};

export interface GeneratedScroll {
  files: Record<string, string>;
}

export function generateScrollSite(p: ScrollProject): GeneratedScroll {
  const root = "scroll-site";
  return {
    files: {
      [`${root}/index.html`]: indexHtml(p),
      [`${root}/styles.css`]: stylesCss(p),
      [`${root}/scroll.js`]: scrollJs(p),
      [`${root}/app_config.json`]: JSON.stringify(p, null, 2) + "\n",
      [`${root}/README.md`]: docs.readme(p),
      [`${root}/LICENSES.md`]: docs.licenses(),
      [`${root}/PERFORMANCE_NOTES.md`]: docs.perf(p),
      [`${root}/ACCESSIBILITY_NOTES.md`]: docs.a11y(),
      [`${root}/assets/.gitkeep`]: "",
    },
  };
}
