// ============================================================
// Sensor Interaction — standalone module generator (pure)
// ============================================================
// SensorProfile → a framework-free motion controller (sensors.js) +
// a small demo (index.html) that wires DeviceOrientation/Motion with a
// PERMISSION request (iOS requires a user gesture), the deadzone/
// invert/smoothing math, MANDATORY non-motion fallback controls, and
// reduced-motion respect. No storage, no upload, no tracking.
// ============================================================

import type { SensorProfile } from "./schemas.ts";
import { SENSOR_DISCLOSURE } from "./schemas.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sensorsJs(p: SensorProfile): string {
  const cfg = JSON.stringify({ enableGyro: p.enableGyro, enableAccel: p.enableAccel, sensitivity: p.sensitivity, smoothing: p.smoothing, deadZone: p.deadZone, invertX: p.invertX, invertY: p.invertY, shakeThreshold: p.shakeThreshold, respectReducedMotion: p.respectReducedMotion });
  return `// Motion controller for "${p.name}". Framework-free, offline.
// Motion is OPTIONAL: nothing breaks if it's off — wire up your manual controls.
// No sensor data is stored or uploaded.
export function createMotion(opts) {
  var CFG = ${cfg};
  var onMove = (opts && opts.onMove) || function () {};
  var onShake = (opts && opts.onShake) || function () {};
  var RANGE = 45, last = { x: 0, y: 0 }, prevA = null, running = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  function dz(v) { var z = CFG.deadZone; if (Math.abs(v) <= z) return 0; return (v < 0 ? -1 : 1) * ((Math.abs(v) - z) / (1 - z)); }
  function onOrient(e) {
    var x = clamp((e.gamma || 0) / RANGE), y = clamp((e.beta || 0) / RANGE);
    x = dz(x) * CFG.sensitivity; y = dz(y) * CFG.sensitivity;
    if (CFG.invertX) x = -x; if (CFG.invertY) y = -y;
    var s = Math.max(0, Math.min(0.95, CFG.smoothing));
    last = { x: last.x * s + clamp(x) * (1 - s), y: last.y * s + clamp(y) * (1 - s) };
    onMove(last);
  }
  function onMotion(e) {
    var a = (e.accelerationIncludingGravity) || { x: 0, y: 0, z: 0 };
    if (prevA) { var d = Math.sqrt(Math.pow(a.x - prevA.x, 2) + Math.pow(a.y - prevA.y, 2) + Math.pow(a.z - prevA.z, 2)); if (d >= CFG.shakeThreshold) onShake(); }
    prevA = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };
  }
  function attach() {
    running = true;
    if (CFG.enableGyro) window.addEventListener("deviceorientation", onOrient, true);
    if (CFG.enableAccel) window.addEventListener("devicemotion", onMotion, true);
  }
  return {
    supported: function () { return "DeviceOrientationEvent" in window || "DeviceMotionEvent" in window; },
    // Must be called from a user gesture on iOS.
    start: async function () {
      if (CFG.respectReducedMotion && reduce) return { ok: false, reason: "reduced-motion" };
      try {
        var DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === "function") {
          var res = await DOE.requestPermission();
          if (res !== "granted") return { ok: false, reason: "permission-denied" };
        }
        attach();
        return { ok: true };
      } catch (err) { return { ok: false, reason: "error" }; }
    },
    stop: function () { running = false; window.removeEventListener("deviceorientation", onOrient, true); window.removeEventListener("devicemotion", onMotion, true); },
    isRunning: function () { return running; }
  };
}
`;
}

function indexHtml(p: SensorProfile): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #111; color: #fff; text-align: center; }
    #stage { position: relative; height: 60vh; margin: 16px; border: 1px solid #333; border-radius: 14px; overflow: hidden; }
    #dot { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px; border-radius: 50%; background: #4ea1ff; transition: transform .05s linear; }
    button { background: #2563eb; color: #fff; border: 0; border-radius: 999px; padding: 12px 18px; margin: 6px; font-size: 16px; }
    .controls button { background: #333; }
    .notice { font-size: 12px; color: #aaa; max-width: 560px; margin: 8px auto; }
  </style>
</head>
<body>
  <h3>${esc(p.name)}</h3>
  <div id="stage"><div id="dot"></div></div>
  <div><button id="enable">Use motion</button> <span id="status" class="notice">Motion is optional — the buttons below always work.</span></div>
  <!-- MANDATORY non-motion fallback: works with sensors off / denied / reduced-motion -->
  <div class="controls">
    <button data-dir="up">▲</button><br>
    <button data-dir="left">◀</button>
    <button data-dir="right">▶</button><br>
    <button data-dir="down">▼</button>
  </div>
  <p class="notice">${esc(SENSOR_DISCLOSURE)}</p>
  <script type="module">
    import { createMotion } from "./sensors.js";
    var dot = document.getElementById("dot"), stage = document.getElementById("stage");
    var pos = { x: 0, y: 0 };
    function place() {
      var w = stage.clientWidth / 2 - 30, h = stage.clientHeight / 2 - 30;
      dot.style.transform = "translate(" + (pos.x * w) + "px," + (pos.y * h) + "px)";
    }
    var motion = createMotion({ onMove: function (v) { pos = v; place(); }, onShake: function () { stage.style.background = "#225"; setTimeout(function () { stage.style.background = ""; }, 150); } });
    document.getElementById("enable").addEventListener("click", async function () {
      var r = await motion.start();
      document.getElementById("status").textContent = r.ok ? "Motion on — tilt your phone." : "Motion unavailable (" + r.reason + ") — use the buttons.";
    });
    // fallback buttons (always available)
    document.querySelectorAll(".controls button").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = b.getAttribute("data-dir"), step = 0.2;
        if (d === "left") pos.x = Math.max(-1, pos.x - step);
        if (d === "right") pos.x = Math.min(1, pos.x + step);
        if (d === "up") pos.y = Math.max(-1, pos.y - step);
        if (d === "down") pos.y = Math.min(1, pos.y + step);
        place();
      });
    });
    place();
  </script>
</body>
</html>
`;
}

export interface GeneratedSensor { files: Record<string, string> }

export function generateSensorModule(p: SensorProfile): GeneratedSensor {
  const root = "sensor-module";
  return {
    files: {
      [`${root}/sensors.js`]: sensorsJs(p),
      [`${root}/index.html`]: indexHtml(p),
      [`${root}/app_config.json`]: JSON.stringify(p, null, 2) + "\n",
      [`${root}/README.md`]: `# ${p.name}\n\nA framework-free motion controller from Creation Studio.\n\n- \`sensors.js\` — \`createMotion({ onMove, onShake })\` → \`{ start, stop, supported }\`.\n- \`index.html\` — a demo: tilt to move a dot, with on-screen buttons that always work.\n\nMotion is OPTIONAL. Call \`start()\` from a button tap (iOS requires a gesture to grant permission). Always keep your manual controls — see ACCESSIBILITY below.\n`,
      [`${root}/PRIVACY_NOTES.md`]: `# Privacy & accessibility\n\n${SENSOR_DISCLOSURE}\n\n- Permission is requested explicitly; on iOS it needs a user gesture.\n- No sensor data is stored or uploaded; it's used live only.\n- Sensors are never used for tracking.\n- Reduced-motion (OS setting) disables motion automatically when respected.\n- Manual controls (buttons/touch) are always present as a fallback.\n`,
    },
  };
}
