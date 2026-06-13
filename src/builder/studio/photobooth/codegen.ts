// ============================================================
// Photo Booth — standalone booth code generator (pure)
// ============================================================
// BoothProject → a self-contained offline photo booth web app:
// index.html + booth.js (getUserMedia → countdown → capture →
// compose per layout → filter + footer → local download). No
// upload, no face recognition, no libraries, no CDN. The camera is
// requested explicitly and only runs while the page is open.
// ============================================================

import type { BoothProject } from "./schemas.ts";
import { boothCanvas, photoSlots } from "./layout.ts";
import { FILTER_CSS } from "./schemas.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PRIVACY_NOTICE =
  "This Photo Booth uses the device camera only while this page is open. Photos are saved locally to your device unless you choose to export, print, or share them. Nothing is uploaded automatically.";

function indexHtml(p: BoothProject): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.name)}</title>
  <style>
    :root { --brand: ${esc(p.brandColor)}; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #fff; text-align: center; }
    header { padding: 12px; }
    #stage { max-width: 720px; margin: 0 auto; padding: 8px; }
    video, #out { width: 100%; border-radius: 14px; background: #000; }
    .hidden { display: none; }
    button { background: var(--brand); color: #fff; border: 0; border-radius: 999px; padding: 12px 22px; font-size: 16px; font-weight: 600; margin: 6px; cursor: pointer; }
    button.ghost { background: #333; }
    #count { font-size: 96px; font-weight: 800; position: fixed; inset: 0; display: none; align-items: center; justify-content: center; }
    .notice { font-size: 12px; color: #aaa; max-width: 640px; margin: 8px auto; }
    .live { color: #f55; font-weight: 700; }
  </style>
</head>
<body>
  <header><strong>${esc(p.eventName || p.name)}</strong>${p.eventDate ? ` · ${esc(p.eventDate)}` : ""}</header>
  <div id="stage">
    <video id="cam" autoplay playsinline muted></video>
    <canvas id="out" class="hidden"></canvas>
    <div>
      <button id="start">Start (${photoSlots(p)} photo${photoSlots(p) > 1 ? "s" : ""})</button>
      <button id="save" class="hidden">Save photo</button>
      ${p.retakeAllowed ? '<button id="retake" class="ghost hidden">Retake</button>' : ""}
    </div>
    <p id="status" class="notice">Tap Start. <span id="liveDot" class="hidden live">● camera on</span></p>
    <p class="notice">${esc(PRIVACY_NOTICE)}</p>
  </div>
  <div id="count"></div>
  <script src="booth.js" defer></script>
</body>
</html>
`;
}

function boothJs(p: BoothProject): string {
  const cv = boothCanvas(p);
  const cfg = JSON.stringify({
    slots: photoSlots(p),
    countdown: p.countdown,
    filter: FILTER_CSS[p.filter],
    canvas: cv,
    brand: p.brandColor,
    eventName: p.eventName,
    eventDate: p.eventDate,
    logoUrl: p.logoUrl,
    frameUrl: p.frameUrl,
    askBeforeSave: p.askBeforeSave,
  });
  return `// ${p.name} — offline photo booth. No upload, no face recognition.
(function () {
  var CFG = ${cfg};
  var cam = document.getElementById("cam"), out = document.getElementById("out");
  var startB = document.getElementById("start"), saveB = document.getElementById("save"), retakeB = document.getElementById("retake");
  var statusEl = document.getElementById("status"), liveDot = document.getElementById("liveDot"), countEl = document.getElementById("count");
  var stream = null, captures = [];

  function setStatus(t) { statusEl.firstChild ? statusEl.firstChild.nodeValue = t + " " : statusEl.textContent = t; }

  async function ensureCamera() {
    if (stream) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cam.srcObject = stream; liveDot.classList.remove("hidden");
      return true;
    } catch (e) { setStatus("Camera permission is needed to take photos."); return false; }
  }
  function stopCamera() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; liveDot.classList.add("hidden"); } }
  window.addEventListener("pagehide", stopCamera);

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function countdown(n) {
    if (n <= 0) return;
    countEl.style.display = "flex";
    for (var i = n; i > 0; i--) { countEl.textContent = String(i); await wait(1000); }
    countEl.style.display = "none";
  }
  function grab() {
    var c = document.createElement("canvas"); c.width = cam.videoWidth || 640; c.height = cam.videoHeight || 480;
    c.getContext("2d").drawImage(cam, 0, 0, c.width, c.height);
    return c;
  }
  function compose() {
    out.width = CFG.canvas.width; out.height = CFG.canvas.height;
    var ctx = out.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.filter = CFG.filter || "none";
    CFG.canvas.cells.forEach(function (cell, i) {
      var src = captures[i]; if (!src) return;
      // cover-fit the capture into the cell
      var s = Math.max(cell.w / src.width, cell.h / src.height);
      var sw = cell.w / s, sh = cell.h / s, sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
      ctx.drawImage(src, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
    });
    ctx.filter = "none";
    var f = CFG.canvas.footer;
    ctx.fillStyle = CFG.brand; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.font = "bold 34px system-ui, sans-serif";
    var label = (CFG.eventName || "") + (CFG.eventDate ? "  ·  " + CFG.eventDate : "");
    if (label) ctx.fillText(label, f.x + 18, f.y + f.h / 2);
    out.classList.remove("hidden"); cam.classList.add("hidden");
  }
  async function run() {
    if (!(await ensureCamera())) return;
    startB.classList.add("hidden"); captures = [];
    for (var i = 0; i < CFG.slots; i++) { await countdown(CFG.countdown); captures.push(grab()); await wait(300); }
    compose();
    saveB.classList.remove("hidden"); if (retakeB) retakeB.classList.remove("hidden");
    setStatus("Looks good! Save it, or retake.");
  }
  startB.addEventListener("click", run);
  saveB.addEventListener("click", function () {
    if (CFG.askBeforeSave && !confirm("Save this photo to your device?")) return;
    var a = document.createElement("a"); a.href = out.toDataURL("image/png");
    a.download = "photo-booth-" + Date.now() + ".png"; a.click();
  });
  if (retakeB) retakeB.addEventListener("click", function () {
    out.classList.add("hidden"); cam.classList.remove("hidden");
    saveB.classList.add("hidden"); retakeB.classList.add("hidden"); startB.classList.remove("hidden");
  });
})();
`;
}

export interface GeneratedBooth {
  files: Record<string, string>;
}

export function generateBooth(p: BoothProject): GeneratedBooth {
  const root = "photo-booth";
  return {
    files: {
      [`${root}/index.html`]: indexHtml(p),
      [`${root}/booth.js`]: boothJs(p),
      [`${root}/app_config.json`]: JSON.stringify(p, null, 2) + "\n",
      [`${root}/README.md`]: `# ${p.name}\n\nAn offline photo booth from Creation Studio. Open \`index.html\` in a browser on a device with a camera (or host it over https for mobile). Tap **Start** — it asks for camera permission, counts down, captures ${photoSlots(p)} photo(s), composes them, and lets you save locally.\n\nNo libraries, no internet, no uploads. Put your own logo/frame in \`assets/\` and set their paths in \`app_config.json\`.\n`,
      [`${root}/LICENSES.md`]: `# Licenses\n\nNo third-party libraries. The code is yours. Use only your own or properly licensed frames, logos, and stickers — no copyrighted characters, music, or branded assets without permission.\n`,
      [`${root}/PRIVACY_NOTES.md`]: `# Privacy\n\n${PRIVACY_NOTICE}\n\n- The camera is requested explicitly and runs only while the page is open (it stops on leaving).\n- No photos are uploaded; saving is a local download you trigger.\n- No face recognition, no biometric data, no identity tracking.\n- Browsers require https (or localhost) for camera access.\n`,
      [`${root}/assets/.gitkeep`]: "",
    },
  };
}
