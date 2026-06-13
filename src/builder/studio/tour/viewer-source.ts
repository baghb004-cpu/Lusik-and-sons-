// ============================================================
// Virtual Tour — the bundled WebGL viewer source (§30, Phase 6)
// ============================================================
// A tiny, dependency-free equirectangular 360 viewer (no Three.js, no
// CDN). Rendered as one fullscreen quad whose fragment shader turns each
// pixel into a view ray and samples the panorama — so there's no sphere
// geometry or matrix math. Drag/touch to look; optional gyro; DOM hotspot
// overlays. This same string powers both the export and the in-app
// preview (so there's one source of truth). It's an ESM module.
// ============================================================

export const PANO_VIEWER_JS = String.raw`
const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const FRAG = [
  "precision highp float;",
  "uniform sampler2D tex; uniform vec2 res; uniform float yaw; uniform float pitch; uniform float fovy; uniform float aspect;",
  "const float PI = 3.14159265359;",
  "void main(){",
  "  vec2 uv = (gl_FragCoord.xy / res) * 2.0 - 1.0;",
  "  float t = tan(fovy * 0.5);",
  "  vec3 ray = normalize(vec3(uv.x * t * aspect, uv.y * t, -1.0));",
  "  float cp = cos(pitch), sp = sin(pitch);",
  "  ray = vec3(ray.x, ray.y*cp - ray.z*sp, ray.y*sp + ray.z*cp);",
  "  float cy = cos(yaw), sy = sin(yaw);",
  "  ray = vec3(ray.x*cy + ray.z*sy, ray.y, -ray.x*sy + ray.z*cy);",
  "  float u = atan(ray.x, -ray.z) / (2.0*PI) + 0.5;",
  "  float v = 0.5 - asin(clamp(ray.y, -1.0, 1.0)) / PI;",
  "  gl_FragColor = texture2D(tex, vec2(u, v));",
  "}",
].join("\n");

function compile(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
function dirFromYawPitch(y, p) { y *= Math.PI/180; p *= Math.PI/180; return { x: -Math.cos(p)*Math.sin(y), y: Math.sin(p), z: -Math.cos(p)*Math.cos(y) }; }

export function createPanoViewer(canvas, opts) {
  opts = opts || {};
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) { if (opts.onError) opts.onError("WebGL isn't available — showing a still image instead."); return null; }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = function (n) { return gl.getUniformLocation(prog, n); };
  var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  var yaw = 0, pitch = 0, fov = (opts.fov || 75) * Math.PI/180, source = null, isVideo = false, raf = 0, hotspots = [];

  function resize() { var dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; }
  function upload() { if (!source) return; gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); }

  function project(d) {
    // right = normalize(cross(f,(0,1,0))) = (-f.z,0,f.x); up = cross(r,f)
    var f = dirFromYawPitch(yaw*180/Math.PI, pitch*180/Math.PI);
    var rx = -f.z, rz = f.x; var rl = Math.hypot(rx, rz) || 1; rx/=rl; rz/=rl;
    var u = { x: -rz*f.y, y: rz*f.x - rx*f.z, z: rx*f.y };
    var cz = d.x*f.x + d.y*f.y + d.z*f.z; if (cz <= 0.0001) return null;
    var t = Math.tan(fov/2); var aspect = canvas.clientWidth / canvas.clientHeight;
    var sx = (d.x*rx + d.z*rz) / cz / (t*aspect);
    var sy = (d.x*u.x + d.y*u.y + d.z*u.z) / cz / t;
    if (Math.abs(sx) > 1.15 || Math.abs(sy) > 1.15) return null;
    return { x: (sx*0.5+0.5)*100, y: (0.5 - sy*0.5)*100 };
  }

  function render() {
    raf = requestAnimationFrame(render);
    if (canvas.width !== Math.floor(canvas.clientWidth*(Math.min(window.devicePixelRatio||1,2))) ) resize();
    if (isVideo && source && source.readyState >= 2) upload();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U("res"), canvas.width, canvas.height);
    gl.uniform1f(U("yaw"), yaw); gl.uniform1f(U("pitch"), pitch); gl.uniform1f(U("fovy"), fov);
    gl.uniform1f(U("aspect"), canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    for (var i = 0; i < hotspots.length; i++) {
      var h = hotspots[i]; var pos = project(dirFromYawPitch(h.yaw, h.pitch));
      if (pos) { h.el.style.display = "block"; h.el.style.left = pos.x + "%"; h.el.style.top = pos.y + "%"; }
      else h.el.style.display = "none";
    }
  }

  // drag to look
  var dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", function (e) { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", function (e) { if (!dragging) return; yaw -= (e.clientX - lx) * 0.005; pitch += (e.clientY - ly) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch)); lx = e.clientX; ly = e.clientY; });
  canvas.addEventListener("pointerup", function () { dragging = false; });

  resize(); render();
  return {
    setScene: function (scene, els) {
      yaw = (scene.startYaw || 0) * Math.PI/180; pitch = (scene.startPitch || 0) * Math.PI/180;
      hotspots = els || [];
    },
    setTexture: function (el, video) { source = el; isVideo = !!video; upload(); },
    enableGyro: async function () {
      try { var DOE = window.DeviceOrientationEvent; if (DOE && typeof DOE.requestPermission === "function") { if (await DOE.requestPermission() !== "granted") return false; } } catch (e) { return false; }
      window.addEventListener("deviceorientation", function (e) { if (e.alpha == null) return; yaw = -e.alpha * Math.PI/180; pitch = Math.max(-1.5, Math.min(1.5, ((e.beta||0) - 90) * Math.PI/180)); }, true);
      return true;
    },
    look: function (y, p) { yaw = y*Math.PI/180; pitch = p*Math.PI/180; },
    destroy: function () { cancelAnimationFrame(raf); }
  };
}
if (typeof window !== "undefined") window.createPanoViewer = createPanoViewer;
`;
