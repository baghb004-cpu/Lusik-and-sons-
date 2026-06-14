// ============================================================
// Virtual Tour — code generator (pure, §30, Phase 6)
// ============================================================
// TourProject → a standalone offline 360 viewer (index.html + viewer.js
// + your media in assets/). Also an inlined single-file build (media as
// data URLs, viewer inlined) used for the in-app live preview. The
// viewer is the bundled dependency-free WebGL one — no CDN, no libraries.
// ============================================================

import type { TourProject } from "./schemas.ts";
import { PANO_VIEWER_JS } from "./viewer-source.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The runtime that wires the viewer to the project (scene switching, hotspots,
// gyro, fullscreen). `srcMap` resolves each scene id → image/video URL.
function glue(project: TourProject, srcMap: Record<string, string>): string {
  const scenes = project.scenes.map((s) => ({ id: s.id, name: s.name, mediaType: s.mediaType, src: srcMap[s.id] || "", startYaw: s.startYaw, startPitch: s.startPitch, autoplay: s.autoplay, loop: s.loop, hotspots: s.hotspots }));
  const cfg = JSON.stringify({ fov: project.fov, enableGyro: project.enableGyro, scenes });
  return `
(function init(){
  if (!window.createPanoViewer) return setTimeout(init, 30);
  var CFG = ${cfg};
  var canvas = document.getElementById("pano"), hs = document.getElementById("hotspots"), thumbs = document.getElementById("thumbs"), pop = document.getElementById("pop");
  var viewer = window.createPanoViewer(canvas, { fov: CFG.fov, onError: function(m){ document.getElementById("fallback").style.display="block"; document.getElementById("fallback").textContent=m; } });
  if (!viewer) return;
  function show(text){ pop.textContent = text; pop.style.display = "block"; setTimeout(function(){ pop.style.display="none"; }, 4000); }
  function loadScene(id){
    var sc = CFG.scenes.filter(function(s){return s.id===id;})[0] || CFG.scenes[0]; if (!sc) return;
    hs.innerHTML = "";
    var els = sc.hotspots.map(function(h){
      var b = document.createElement("button"); b.className = "hotspot"; b.textContent = h.label || "•"; b.title = h.label || "";
      b.addEventListener("click", function(){
        if (h.kind === "scene" && h.targetSceneId) loadScene(h.targetSceneId);
        else if (h.kind === "link" && h.text) window.open(h.text, "_blank");
        else show(h.text || h.label || "");
      });
      hs.appendChild(b); return { yaw: h.yaw, pitch: h.pitch, el: b };
    });
    viewer.setScene(sc, els);
    if (sc.mediaType === "video") {
      var v = document.createElement("video"); v.src = sc.src; v.crossOrigin = "anonymous"; v.loop = sc.loop; v.muted = true; v.playsInline = true; v.play().catch(function(){});
      v.addEventListener("loadeddata", function(){ viewer.setTexture(v, true); });
    } else {
      var img = new Image(); img.crossOrigin = "anonymous"; img.onload = function(){ viewer.setTexture(img, false); }; img.src = sc.src;
    }
  }
  // thumbnails
  CFG.scenes.forEach(function(sc){ var t = document.createElement("button"); t.textContent = sc.name; t.addEventListener("click", function(){ loadScene(sc.id); }); thumbs.appendChild(t); });
  if (CFG.scenes.length < 2) thumbs.style.display = "none";
  document.getElementById("gyro").addEventListener("click", async function(){ var ok = await viewer.enableGyro(); this.textContent = ok ? "Gyro on" : "Gyro unavailable"; });
  document.getElementById("full").addEventListener("click", function(){ (canvas.requestFullscreen||canvas.webkitRequestFullscreen||function(){}).call(canvas); });
  if (CFG.scenes[0]) loadScene(CFG.scenes[0].id);
})();
`;
}

function page(project: TourProject, srcMap: Record<string, string>, inlineViewer: boolean): string {
  const viewerTag = inlineViewer ? `<script type="module">${PANO_VIEWER_JS}</script>` : `<script type="module" src="viewer.js"></script>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(project.name)}</title>
  <style>
    html,body{margin:0;height:100%;background:#000;font-family:system-ui,sans-serif;color:#fff;}
    #wrap{position:relative;width:100%;height:100%;overflow:hidden;}
    #pano{width:100%;height:100%;display:block;touch-action:none;cursor:grab;}
    #hotspots{position:absolute;inset:0;pointer-events:none;}
    .hotspot{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;background:rgba(0,0,0,.55);color:#fff;border:2px solid #fff;border-radius:999px;min-width:26px;height:26px;padding:0 8px;font-size:12px;cursor:pointer;}
    #bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:6px;padding:8px;flex-wrap:wrap;align-items:center;background:linear-gradient(transparent,rgba(0,0,0,.6));}
    #bar button{background:#222;color:#fff;border:0;border-radius:999px;padding:8px 12px;font-size:13px;cursor:pointer;}
    #thumbs{display:flex;gap:6px;flex-wrap:wrap;}
    #pop{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:rgba(0,0,0,.8);padding:8px 14px;border-radius:10px;display:none;max-width:80%;}
    #fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:20px;text-align:center;}
  </style>
</head>
<body>
  <div id="wrap">
    <canvas id="pano"></canvas>
    <div id="hotspots"></div>
    <div id="pop"></div>
    <div id="fallback"></div>
    <div id="bar"><div id="thumbs"></div><span style="flex:1"></span><button id="gyro">Use gyro</button><button id="full">Fullscreen</button></div>
  </div>
  ${viewerTag}
  <script>${glue(project, srcMap)}</script>
</body>
</html>
`;
}

export interface GeneratedTour { files: Record<string, string> }

/** Standalone export (separate viewer.js + media under assets/). */
export function generateTour(project: TourProject): GeneratedTour {
  const root = "virtual-tour";
  const srcMap: Record<string, string> = {};
  for (const s of project.scenes) srcMap[s.id] = `assets/${s.src || s.id}`;
  return {
    files: {
      [`${root}/index.html`]: page(project, srcMap, false),
      [`${root}/viewer.js`]: PANO_VIEWER_JS,
      [`${root}/app_config.json`]: JSON.stringify(project, null, 2) + "\n",
      [`${root}/README.md`]: `# ${project.name}\n\nA 360 virtual tour from Creation Studio. Open \`index.html\` (host over http(s) so the browser allows WebGL textures). Drag to look; tap hotspots; use Gyro on a phone.\n\nThe viewer (\`viewer.js\`) is a tiny dependency-free WebGL panorama renderer — no libraries, no internet. Put your equirectangular 360 photos/videos in \`assets/\`.\n`,
      [`${root}/LICENSES.md`]: `# Licenses\n\nNo third-party libraries. Use only your own or properly licensed 360 media — no copyrighted videos, music, maps, or branded media.\n`,
      [`${root}/assets/.gitkeep`]: "",
    },
  };
}

/** A single self-contained HTML (media inlined as data URLs, viewer inlined) —
 *  used for the in-app live preview (iframe srcdoc) and as a one-file export. */
export function inlineTourHtml(project: TourProject, assets: Record<string, string>): string {
  const srcMap: Record<string, string> = {};
  for (const s of project.scenes) srcMap[s.id] = assets[s.src] || assets[s.id] || "";
  return page(project, srcMap, true);
}
