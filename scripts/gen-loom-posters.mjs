#!/usr/bin/env node
// ============================================================
// gen-loom-posters.mjs — the still image every 3D stage shows first
// ============================================================
// Every Loom stage renders a poster as its LCP element and only fades the
// canvas over it once a first frame exists. On a `low` device, with no
// WebGL, or with the engine flag off, the poster is what the customer
// sees — permanently. So it cannot be a placeholder; it has to be the
// product.
//
// The honest way to produce it is to let the engine draw it. This boots
// the real rig in a headless browser, renders one frame at the default
// pose, and writes the result to public/img/loom/. Nothing here
// approximates the engine, so a poster cannot drift away from what the
// live stage shows.
//
// NOT part of `gen:data` and not a build step: it needs a browser and
// takes seconds per product. Run it when a rig or the default pose
// changes, and commit the output.
//
//   npm run gen:loom-posters
//
// Requires the repo's Playwright Chromium (or PLAYWRIGHT_CHROMIUM_EXECUTABLE).
// ============================================================

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(ROOT, "public", "img", "loom");
const WORK = join(ROOT, ".loom-poster-build");

// One entry per rig the stage can mount. `design` is what gets stitched
// into the poster — a real, representative design, not lorem ipsum.
const PRODUCTS = [
  {
    key: "blanket-classic",
    file: "alphabet-blanket.webp",
    width: 1200,
    height: 900,
    clothColor: "#F7F3EA",
    design: {
      alphabet: "ԱԲԳԴԵԶԷ",
      line1: "ANI",
      line2: "2026",
      blockColor: "#2B4C73",
      lineColor: "#8B2C2C",
    },
  },
  {
    key: "bib-single",
    file: "name-bib.webp",
    width: 1000,
    height: 1000,
    clothColor: "#FFFFFF",
    rig: "bib",
    design: { name: "Anahit", threadColor: "#8B2C2C" },
  },
];

function bibHarness(product) {
  const { design } = product;
  return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/fonts.css">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<canvas id="c" width="${product.width}" height="${product.height}"></canvas>
<script type="importmap">{"imports":{"three":"/three/three.module.js"}}</script>
<script type="module">
window.__done = (async () => {
  const { createRenderer, createCamera } = await import("/core/renderer.js");
  const { createScene } = await import("/core/scene.js");
  const { createOrbit, POSES } = await import("/core/camera.js");
  const { createBibRig } = await import("/rigs/bib.js");
  // The name is machine embroidery in a script face. Without Allura it
  // falls back to a serif, which reads as print rather than stitching.
  //
  // document.fonts.check() CANNOT be trusted here: with the stylesheet
  // request blocked it still returns true, because a fallback family
  // satisfies the query. The only honest test is to measure — a real
  // script face and the generic fallback do not produce the same advance
  // width for the same string.
  try { await document.fonts.load('400 48px "Allura"', "Anahit"); await document.fonts.ready; } catch {}
  ${FONT_GUARD}
  __requireFont("Allura", "Anahit");

  const canvas = document.getElementById("c");
  const handle = createRenderer({ canvas, tier: "high" });
  const { scene } = createScene(false);
  const camera = createCamera(${product.width} / ${product.height});
  const rig = createBibRig({ textureSize: 1024, clothColor: ${JSON.stringify(product.clothColor)} });
  scene.add(rig.group);
  rig.setDesign(${JSON.stringify(design)});

  const pose = { ...POSES.flat, distance: 3.4, polar: 0.5 };
  const orbit = createOrbit(camera, pose, { reducedMotion: () => true });
  orbit.goTo(pose, true);

  handle.resize(${product.width}, ${product.height});
  handle.start(() => handle.renderer.render(scene, camera));
  handle.invalidate();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  handle.renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL("image/webp", 0.9);
  return { stitches: 0, dataUrl };
})();
</script>`;
}

/**
 * A canvas silently falls back when a webfont is missing, and
 * document.fonts.check() is no help — with the stylesheet request blocked
 * it still returns true, because a fallback family satisfies the query.
 * The only honest test is to measure: both stacks below name the SAME
 * fallback, so identical advance widths mean the real face is absent.
 *
 * (Comparing against a DIFFERENT generic family does not work: those
 * differ whether or not the face loaded, so the guard passes while the
 * poster bakes the wrong typeface. That is how the first version of this
 * shipped a serif name onto a bib.)
 */
const FONT_GUARD = `
  const __probe = document.createElement("canvas").getContext("2d");
  const __fontLoaded = (family, sample) => {
    __probe.font = '400 48px "' + family + '", monospace';
    const a = __probe.measureText(sample).width;
    __probe.font = "400 48px monospace";
    const b = __probe.measureText(sample).width;
    return Math.abs(a - b) >= 0.5;
  };
  const __requireFont = (family, sample) => {
    if (!__fontLoaded(family, sample)) {
      throw new Error(family + " did not load; refusing to bake a poster in the fallback face");
    }
  };
`;

function log(...args) { console.log("[loom-posters]", ...args); }

/** Compile src/loom to plain JS the browser can import. */
function compile() {
  if (existsSync(WORK)) rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const tsconfig = join(WORK, "tsconfig.json");
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      module: "esnext", target: "es2020", moduleResolution: "bundler",
      allowJs: true, checkJs: false, skipLibCheck: true,
      // rootDir is src/, not src/loom/: the engine imports shared pure
      // modules from src/data (blanketLayout.js is the placement both
      // renderers use). With the narrower rootDir tsc tries to emit those
      // over their own sources and fails with TS5055.
      outDir: join(WORK, "js"), rootDir: join(ROOT, "src"),
    },
    // The React shell is not needed and would drag in JSX.
    include: [join(ROOT, "src", "loom", "**/*")],
    exclude: [join(ROOT, "src", "loom", "LoomStage.tsx"), join(ROOT, "src", "loom", "index.ts")],
  }, null, 2));
  execFileSync(process.execPath, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig], { stdio: "inherit" });
  // Beside the compiled engine, because that is the directory the harness
  // is served from and the import map points at "/three/three.module.js".
  mkdirSync(join(WORK, "js", "loom", "three"), { recursive: true });
  for (const f of ["three.module.js", "three.core.js"]) {
    writeFileSync(join(WORK, "js", "loom", "three", f), readFileSync(join(ROOT, "node_modules", "three", "build", f)));
  }
}

function harness(product) {
  if (product.rig === "bib") return bibHarness(product);
  const { design } = product;
  return `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="/fonts.css">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<canvas id="c" width="${product.width}" height="${product.height}"></canvas>
<script type="importmap">{"imports":{"three":"/three/three.module.js"}}</script>
<script type="module">
window.__done = (async () => {
  const { createRenderer, createCamera } = await import("/core/renderer.js");
  const { createScene } = await import("/core/scene.js");
  const { createOrbit, POSES } = await import("/core/camera.js");
  const { createBlanketRig } = await import("/rigs/alphabetBlanket.js");
  const { makeChartResolver } = await import("/stitch/rasterize.js");
  const { planDesign } = await import("/stitch/planner.js");
  try {
    await document.fonts.load('600 40px "Noto Serif Armenian"', "ANI 2026");
    await document.fonts.load('600 40px "Noto Serif Armenian"', "\u0531\u0532\u0533");
    await document.fonts.ready;
  } catch {}
  ${FONT_GUARD}
  // One face draws every stitch on this poster, Latin and Armenian alike
  // — see STITCH_FONT_STACK. Both scripts are checked because they live
  // in different subset files and either can be missing on its own.
  //
  // This used to require "Fraunces" measured on Armenian text, which is a
  // check that can never pass: Fraunces has no Armenian coverage, so the
  // measurement always matched the fallback and the run always failed.
  __requireFont("Noto Serif Armenian", "ANI 2026");
  __requireFont("Noto Serif Armenian", "\u0531\u0532\u0533");

  const W = 13, H = 15;
  const chartFor = makeChartResolver({});
  const lines = [];
  const alphabet = ${JSON.stringify(design.alphabet)};
  for (let i = 0; i < alphabet.length; i++) {
    lines.push({ text: alphabet[i], slot: { x: i*W, y: 0, w: W, h: H }, color: ${JSON.stringify(design.blockColor)} });
  }
  lines.push({ text: ${JSON.stringify(design.line1)}, slot: { x: 0, y: H*3, w: W*alphabet.length, h: H }, color: ${JSON.stringify(design.lineColor)} });
  lines.push({ text: ${JSON.stringify(design.line2)}, slot: { x: 0, y: H*5, w: W*alphabet.length, h: H }, color: ${JSON.stringify(design.lineColor)} });
  const planned = planDesign({ lines, chartFor });
  if (planned.unknown.length) throw new Error("unstitchable characters in poster design: " + planned.unknown.join(","));

  const canvas = document.getElementById("c");
  // Posters are drawn at the top tier regardless of what this machine is:
  // the image is baked once and served to everyone.
  const handle = createRenderer({ canvas, tier: "high" });
  const { scene } = createScene(false);
  const camera = createCamera(${product.width} / ${product.height});
  const rig = createBlanketRig({ textureSize: 1024, clothColor: ${JSON.stringify(product.clothColor)} });
  scene.add(rig.group);
  rig.setStitches(planned.stitches);

  // The rig centres itself on the origin, so POSES.flat aims correctly.
  // A poster wants the cloth a little larger in frame than the stage does,
  // since it has no surrounding UI.
  const pose = { ...POSES.flat, distance: 2.9 };
  const orbit = createOrbit(camera, pose, { reducedMotion: () => true });
  orbit.goTo(pose, true);

  handle.resize(${product.width}, ${product.height});
  handle.start(() => handle.renderer.render(scene, camera));
  handle.invalidate();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Encode in the browser: this is the LCP element on every product page,
  // and WebP at q0.9 is a fraction of the PNG for no visible difference.
  // Playwright's screenshot() only writes PNG or JPEG, and JPEG cannot
  // hold the transparent background the stage composites over.
  //
  // The render MUST happen in the same tick as toDataURL. A WebGL drawing
  // buffer is cleared once the frame is presented, so reading it a tick
  // later returns a fully transparent image — which is exactly what the
  // first version of this script wrote: 1200x900, one colour, zero alpha,
  // 2 KB. preserveDrawingBuffer would also work but costs memory on every
  // frame the live stage draws, for a guarantee only this script needs.
  handle.renderer.render(scene, camera);
  const dataUrl = canvas.toDataURL("image/webp", 0.9);
  return { stitches: planned.stitches.length, dataUrl };
})();
</script>`;
}

async function main() {
  const { chromium } = await import("@playwright/test");
  compile();
  mkdirSync(OUT_DIR, { recursive: true });

  const jsRoot = join(WORK, "js", "loom");
  const pages = new Map();
  // The site self-hosts its faces, so the harness serves the repo's own
  // fonts.css and woff2 files. Nothing here touches the network: a
  // generator that needs the internet is one that fails differently on
  // every machine, and its font guard would then report a missing
  // typeface when the real problem was a missing route.
  const FONTS_CSS = join(ROOT, "src", "styles", "fonts.css");
  const FONTS_DIR = join(ROOT, "public", "fonts");

  const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split("?")[0]);
    if (pages.has(path)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pages.get(path));
      return;
    }
    if (path === "/fonts.css") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      res.end(readFileSync(FONTS_CSS));
      return;
    }
    if (path.startsWith("/fonts/")) {
      // basename only — the harness is local, but a served directory
      // still has no business honouring "..".
      const name = path.slice("/fonts/".length);
      if (name.includes("/") || name.includes("..")) { res.writeHead(400); res.end(); return; }
      try {
        res.writeHead(200, { "content-type": "font/woff2" });
        res.end(readFileSync(join(FONTS_DIR, name)));
      } catch { res.writeHead(404); res.end(); }
      return;
    }
    // src/loom imports TypeScript modules without an extension (the repo's
    // convention, since webpack resolves them). tsc does not rewrite the
    // specifiers, so serve `/foo` as `/foo.js` the way a bundler would.
    const candidates = extname(path) ? [path] : [path, `${path}.js`, `${path}/index.js`];
    for (const candidate of candidates) {
      try {
        // Shared modules land beside loom/ under js/, so try both roots.
      const body = readFileSync(
        candidate.startsWith("/data/") || candidate.startsWith("/lib/")
          ? join(WORK, "js", candidate)
          : join(jsRoot, candidate),
      );
        res.writeHead(200, {
          "content-type": extname(candidate) === ".html" ? "text/html" : "text/javascript; charset=utf-8",
        });
        res.end(body);
        return;
      } catch { /* try the next candidate */ }
    }
    res.writeHead(404);
    res.end("not found: " + path);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });

  let failures = 0;
  for (const product of PRODUCTS) {
    const path = `/${product.key}.html`;
    pages.set(path, harness(product));
    const page = await browser.newPage({
      viewport: { width: product.width, height: product.height },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "domcontentloaded" });
      const result = await page.evaluate(() => window.__done);
      if (!result.dataUrl?.startsWith("data:image/webp")) {
        throw new Error("browser did not encode WebP (got " + String(result.dataUrl).slice(0, 30) + ")");
      }
      const bytes = Buffer.from(result.dataUrl.split(",")[1], "base64");
      // A blank poster is the failure mode that matters: it looks like a
      // success in the log and ships an invisible product photo to every
      // device that cannot run the engine. An empty 1200x900 WebP is
      // about 2 KB; a real render of this blanket is tens of KB.
      if (bytes.length < 8 * 1024) {
        throw new Error(
          `poster is only ${(bytes.length / 1024).toFixed(1)} KB, which means the canvas was blank. ` +
          "The WebGL drawing buffer is cleared after present — render in the same tick as toDataURL.",
        );
      }
      const dest = join(OUT_DIR, product.file);
      writeFileSync(dest, bytes);
      log(`${product.key}: ${result.stitches} stitches -> public/img/loom/${product.file} (${(bytes.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      failures += 1;
      console.error(`[loom-posters] FAILED ${product.key}:`, String(e).slice(0, 400));
      for (const err of errors) console.error("  page error:", err.slice(0, 300));
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();
  rmSync(WORK, { recursive: true, force: true });

  if (failures) {
    // A missing poster is a stage with nothing to show on every device
    // that cannot run the engine. Never let that pass quietly.
    console.error(`[loom-posters] ${failures} poster(s) failed`);
    process.exit(1);
  }
  log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
