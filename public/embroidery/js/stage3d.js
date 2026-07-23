/* Threadwell Studio — 3D stage engine.
   Procedural garment stages (built in code, no model downloads):
   cuff / collar / band (cummerbund) / panel (chest, back, lining…) / pocket.
   The monogram is drawn to a canvas with a thread pattern and revealed
   stitch-by-stitch, then mapped onto the fabric as a decal. */
import * as THREE from 'three';

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer = null, scene, camera, root, keyLight, decalTex, decalMat, stageKind = 'cuff';
let artCanvas = null, texCanvas = null, texCtx = null;
let reveal = { t: 1, dur: 1200, start: 0 };   // reveal progress 0..1
let idleSpin = true, lastPointer = 0, clock = null;
let poseY = 0, poseUntil = 0;                 // "return to front" tween after design changes
let currentCfg = null, host = null, failed = false;

/* ---------- tiny textures ---------- */
function weaveTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 256, 256);
  if (kind === 'pleat') {                    // cummerbund pleats: wide horizontal bands
    for (let y = 0; y < 256; y += 32) {
      const g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#e9e9e9'); g.addColorStop(.5, '#bdbdbd'); g.addColorStop(1, '#a9a9a9');
      x.fillStyle = g; x.fillRect(0, y, 256, 32);
    }
  } else if (kind === 'terry') {             // towel terry: dense looped pile
    x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 5200; n++) {
      const px = Math.random() * 256, py = Math.random() * 256, r = 1 + Math.random() * 1.8;
      x.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.30)' : 'rgba(0,0,0,.16)';
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
  } else if (kind === 'satin') {             // lining satin: soft vertical sheen
    for (let i = 0; i < 256; i += 4) {
      const v = 200 + Math.round(30 * Math.sin(i * .3));
      x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 4, 256);
    }
  } else {                                   // twill weave: fine diagonals + noise
    for (let i = -256; i < 512; i += 4) {
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath();
      x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.10)'; x.beginPath();
      x.moveTo(i + 2, 0); x.lineTo(i + 258, 256); x.stroke();
    }
    for (let n = 0; n < 1400; n++) {
      x.fillStyle = Math.random() > .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ---------- stitched-text art ---------- */
function threadPattern(ctx, color) {
  const p = document.createElement('canvas'); p.width = p.height = 8;
  const x = p.getContext('2d');
  const base = new THREE.Color(color);
  const lite = base.clone().lerp(new THREE.Color('#ffffff'), .38).getStyle();
  const dark = base.clone().lerp(new THREE.Color('#000000'), .30).getStyle();
  x.fillStyle = base.getStyle(); x.fillRect(0, 0, 8, 8);
  x.strokeStyle = lite; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-2, 6); x.lineTo(6, -2); x.moveTo(2, 10); x.lineTo(10, 2); x.stroke();
  x.strokeStyle = dark; x.lineWidth = 1;
  x.beginPath(); x.moveTo(-2, 8); x.lineTo(8, -2); x.moveTo(2, 12); x.lineTo(12, 2); x.stroke();
  return ctx.createPattern(p, 'repeat');
}
function fontFor(cfg, px) {
  if (cfg.mode === 'mono') {
    return cfg.monoStyle === 'script'
      ? `600 ${px}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`
      : `700 ${px}px Georgia,"Times New Roman",serif`;
  }
  return cfg.style === 'cursive'
    ? `600 ${px}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`
    : `700 ${px}px Georgia,"Times New Roman",serif`;
}
/* draw the finished embroidery once to artCanvas */
function drawArt(cfg) {
  const W = 1024, H = 400;
  artCanvas = artCanvas || document.createElement('canvas');
  artCanvas.width = W; artCanvas.height = H;
  const x = artCanvas.getContext('2d');
  x.clearRect(0, 0, W, H);
  const pat = threadPattern(x, cfg.thread);
  const dark = new THREE.Color(cfg.thread).lerp(new THREE.Color('#000'), .55).getStyle();

  function stitched(text, px, cx, cy) {
    x.font = fontFor(cfg, px);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.save();
    x.shadowColor = 'rgba(0,0,0,.38)'; x.shadowBlur = 4; x.shadowOffsetY = 3;
    x.fillStyle = dark; x.fillText(text, cx, cy + 2);
    x.restore();
    x.fillStyle = pat; x.fillText(text, cx, cy);
    x.fillStyle = 'rgba(255,255,255,.22)'; x.fillText(text, cx - 1, cy - 1.5);
  }
  function fit(text, maxPx, maxW) {
    let px = maxPx;
    x.font = fontFor(cfg, px);
    while (px > 26 && x.measureText(text).width > maxW) { px -= 6; x.font = fontFor(cfg, px); }
    return px;
  }

  if (cfg.mode === 'mono' && cfg.monoStyle !== 'straight') {
    // classic stacked: first · LAST(big) · middle
    const f = cfg.mono.f || '', l = cfg.mono.l || '', m = cfg.mono.m || '';
    const big = 300, small = 190;
    x.font = fontFor(cfg, big);
    const wL = x.measureText(l).width;
    x.font = fontFor(cfg, small);
    const wF = x.measureText(f).width, wM = x.measureText(m).width;
    const gap = 26, total = wF + wL + wM + gap * 2;
    const s = Math.min(1, 940 / Math.max(total, 1));
    let cx = (W - total * s) / 2;
    if (f) { stitched(f, small * s, cx + wF * s / 2, H / 2 + 12); cx += (wF + gap) * s; }
    if (l) { stitched(l, big * s, cx + wL * s / 2, H / 2); cx += (wL + gap) * s; }
    if (m) { stitched(m, small * s, cx + wM * s / 2, H / 2 + 12); }
  } else {
    const text = cfg.mode === 'mono'
      ? [cfg.mono.f, cfg.mono.m, cfg.mono.l].filter(Boolean).join(' ')
      : (cfg.text || '');
    if (text) stitched(text, fit(text, 240, 930), W / 2, H / 2);
  }
}
function startReveal(ms) {
  reveal.dur = REDUCE ? 1 : ms;
  reveal.start = performance.now();
  reveal.t = 0;
}
function blitReveal(now) {
  if (!texCtx || !artCanvas) return;
  if (reveal.t >= 1) return;
  reveal.t = Math.min(1, (now - reveal.start) / reveal.dur);
  const e = 1 - Math.pow(1 - reveal.t, 2);           // ease-out
  const w = Math.max(1, Math.round(artCanvas.width * e));
  texCtx.clearRect(0, 0, texCanvas.width, texCanvas.height);
  texCtx.drawImage(artCanvas, 0, 0, w, artCanvas.height, 0, 0, w, texCanvas.height);
  if (reveal.t < 1) {                                 // the travelling "needle" glint
    texCtx.fillStyle = 'rgba(255,255,255,.95)';
    texCtx.beginPath(); texCtx.arc(w, texCanvas.height / 2, 7, 0, 7); texCtx.fill();
    texCtx.fillStyle = 'rgba(255,255,255,.35)';
    texCtx.beginPath(); texCtx.arc(w, texCanvas.height / 2, 16, 0, 7); texCtx.fill();
  }
  if (decalTex) decalTex.needsUpdate = true;
}

/* ---------- stage builders (all procedural) ---------- */
function fabricMat(color, kind) {
  const t = weaveTexture(kind || 'twill');
  t.repeat.set(kind === 'pleat' ? 2 : 3, kind === 'pleat' ? 1 : 2);
  return new THREE.MeshStandardMaterial({
    color, map: t, bumpMap: t, bumpScale: kind === 'satin' ? .12 : kind === 'terry' ? .9 : .4,
    roughness: kind === 'satin' ? .35 : kind === 'terry' ? .96 : .82, side: THREE.DoubleSide
  });
}
function makeDecal(radius, height, theta, curved) {
  texCanvas = document.createElement('canvas');
  texCanvas.width = 1024; texCanvas.height = 400;
  texCtx = texCanvas.getContext('2d');
  decalTex = new THREE.CanvasTexture(texCanvas);
  decalTex.anisotropy = 4;
  decalMat = new THREE.MeshStandardMaterial({
    map: decalTex, transparent: true, roughness: .5, metalness: 0,
    side: THREE.FrontSide, depthWrite: false
  });
  let geo;
  if (curved) {
    geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true,
      -theta / 2, theta);
  } else {
    geo = new THREE.PlaneGeometry(radius, height, 32, 8);
  }
  const m = new THREE.Mesh(geo, decalMat);
  m.renderOrder = 2;
  return m;
}
function contactShadow(size, y) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: .5, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  return m;
}
function billow(geo, amp) {
  const p = geo.attributes.position;
  const w = geo.parameters.width, h = geo.parameters.height;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + .5, v = p.getY(i) / h + .5;
    p.setZ(i, p.getZ(i) + amp * Math.sin(u * Math.PI) * Math.sin(v * Math.PI)
      + amp * .25 * Math.sin(u * 9) * Math.sin(v * 7));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildStage(cfg) {
  // clear — dispose the full GPU footprint, not just geometries: every
  // rebuild creates fresh CanvasTextures (weave, shadow, decal) and
  // materials, and undisposed ones accumulate in VRAM for the session.
  while (root.children.length) {
    const c = root.children.pop();
    c.traverse?.(o => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      mats.forEach(m => {
        m.map?.dispose?.(); m.bumpMap?.dispose?.(); m.alphaMap?.dispose?.();
        m.dispose?.();
      });
    });
  }
  root.rotation.set(0, 0, 0);
  lastPointer = performance.now();          // hold the fresh pose before idle motion starts
  const fab = cfg.fabric || '#f4f2ec';
  const s = cfg.stage;
  stageKind = (s === 'panel' || s === 'pocket') ? 'flat' : 'revolved';

  if (s === 'cuff') {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(34, 31.5, 66, 96, 1, true, -2.62, 5.24),
      fabricMat(fab));
    root.add(band);
    for (const yy of [32, -32]) {                          // hem edges
      const hem = new THREE.Mesh(
        new THREE.CylinderGeometry(yy > 0 ? 34.3 : 31.8, yy > 0 ? 34.3 : 31.8, 1.6, 96, 1, true, -2.62, 5.24),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(fab).lerp(new THREE.Color('#000'), .18), roughness: .9, side: THREE.DoubleSide }));
      hem.position.y = yy; root.add(hem);
    }
    for (const by of [14, -14]) {                          // cufflink buttons near the placket edge
      const b = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2, 24),
        new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: .45 }));
      const a = 1.15;
      b.position.set(Math.sin(a) * 34.6, by, Math.cos(a) * 34.6);
      b.lookAt(b.position.clone().multiplyScalar(2).setY(by));
      root.add(b);
    }
    const d = makeDecal(34.8, 46, 1.7, true); root.add(d);
    root.add(contactShadow(190, -44));
    root.rotation.y = -.28;
    camera.position.set(0, 34, 196); camera.lookAt(0, -4, 0);
  }
  else if (s === 'collar') {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(52, 50, 26, 96, 1, true, -2.4, 4.8),
      fabricMat(fab));
    band.position.y = 6; root.add(band);
    const leaf = new THREE.Mesh(
      new THREE.CylinderGeometry(53, 74, 30, 96, 1, true, -2.1, 4.2),
      fabricMat(fab));
    leaf.position.y = -6; root.add(leaf);
    const d = makeDecal(53, 20, 1.15, true); d.position.y = 7; root.add(d);
    root.add(contactShadow(260, -32));
    root.rotation.y = -.22;
    camera.position.set(0, 30, 226); camera.lookAt(0, -2, 0);
  }
  else if (s === 'band') {                                  // cummerbund
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(96, 96, 62, 96, 1, true, -1.45, 2.9),
      fabricMat(fab, 'pleat'));
    root.add(band);
    const d = makeDecal(97, 44, 1.0, true); root.add(d);
    root.add(contactShadow(320, -42));
    camera.position.set(0, 22, 282); camera.lookAt(0, 0, 20);
  }
  else if (s === 'pocket') {
    const sq = new THREE.Mesh(billow(new THREE.PlaneGeometry(120, 120, 32, 32), 5), fabricMat(fab));
    sq.rotation.z = Math.PI / 4 * .12; root.add(sq);
    const d = makeDecal(74, 30, 0, false);
    d.position.set(-16, -26, 4); root.add(d);
    root.add(contactShadow(240, -66));
    camera.position.set(0, 0, 186); camera.lookAt(0, 0, 0);
  }
  else {                                                    // generic curved fabric panel
    const w = Math.max(90, (cfg.panelMM?.[0] || 130) * 1.15);
    const h = Math.max(60, (cfg.panelMM?.[1] || 70) * 1.15);
    const kind = cfg.weave || (cfg.satin ? 'satin' : 'twill');
    const panel = new THREE.Mesh(billow(new THREE.PlaneGeometry(w, h, 48, 32), Math.min(w, h) * .05), fabricMat(fab, kind));
    root.add(panel);
    const d = makeDecal(w * .84, h * .62, 0, false);
    d.position.z = Math.min(w, h) * .05 + 1.2; root.add(d);
    root.add(contactShadow(Math.max(w, h) * 2, -h * .62));
    const dist = Math.max(w, h) * 1.35;
    camera.position.set(0, h * .1, dist); camera.lookAt(0, 0, 0);
  }
  camera.userData.baseZ = camera.position.z;
}

/* ---------- interaction (tiny custom orbit) ---------- */
function bindOrbit(el) {
  let drag = false, px = 0, py = 0, pinch = 0;
  const down = (x, y) => { drag = true; px = x; py = y; lastPointer = performance.now(); };
  const move = (x, y) => {
    if (!drag) return;
    root.rotation.y += (x - px) * .008;
    root.rotation.x = Math.max(-.5, Math.min(.5, root.rotation.x + (y - py) * .005));
    px = x; py = y; lastPointer = performance.now();
  };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); down(e.clientX, e.clientY); });
  el.addEventListener('pointermove', e => move(e.clientX, e.clientY));
  el.addEventListener('pointerup', () => drag = false);
  el.addEventListener('pointercancel', () => drag = false);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    camera.position.z = Math.max(camera.userData.baseZ * .45,
      Math.min(camera.userData.baseZ * 2.2, camera.position.z * (e.deltaY > 0 ? 1.09 : .92)));
    lastPointer = performance.now();
  }, { passive: false });
  el.addEventListener('touchstart', e => {
    if (e.touches.length === 2) pinch = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) camera.position.z = Math.max(camera.userData.baseZ * .45,
        Math.min(camera.userData.baseZ * 2.2, camera.position.z * (pinch / d)));
      pinch = d; lastPointer = performance.now();
    }
  }, { passive: true });
}

/* ---------- boot ---------- */
function init(hostEl) {
  host = hostEl;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { failed = true; return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 4 / 3, 1, 4000);
  root = new THREE.Group(); scene.add(root);

  keyLight = new THREE.DirectionalLight(0xfff6e8, 2.6);
  keyLight.position.set(90, 140, 160); scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xdfe8ff, .9);
  fill.position.set(-120, 40, -60); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, .55));

  bindOrbit(renderer.domElement);
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host); resize();

  clock = { t: 0 };
  const frame = now => {
    blitReveal(now);
    if (now < poseUntil) {                                       // swing back to face the viewer
      root.rotation.y += (poseY - root.rotation.y) * .14;
      root.rotation.x += (0 - root.rotation.x) * .14;
    }
    if (!REDUCE) {
      keyLight.position.x = 90 + Math.sin(now * .00045) * 110;   // sheen drifts with the light
      keyLight.position.z = 160 + Math.cos(now * .00045) * 40;
      if (idleSpin && now - lastPointer > 6000) {
        if (stageKind === 'flat') {                              // flat fabric sways, never spins edge-on
          root.rotation.y += (Math.sin(now * .00042) * .30 - root.rotation.y) * .02;
          root.rotation.x += (Math.sin(now * .00031) * .10 - root.rotation.x) * .02;
        } else {
          root.rotation.y += .0032;                              // cuffs/collars/bands slowly revolve
        }
      }
    }
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : frame);
  });
  return true;
}

/* ---------- public API ---------- */
window.Stage3D = {
  ok() { return !!renderer && !failed; },
  mount(el) { if (!renderer && !failed) return init(el); return this.ok(); },
  /* cfg: {stage, panelMM, fabric, satin, thread, text, mode, mono:{f,l,m}, monoStyle, style, restitch} */
  update(cfg) {
    if (!renderer) return;
    const stageChanged = !currentCfg || currentCfg.stage !== cfg.stage ||
      currentCfg.fabric !== cfg.fabric || currentCfg.satin !== cfg.satin ||
      currentCfg.weave !== cfg.weave ||
      JSON.stringify(currentCfg.panelMM) !== JSON.stringify(cfg.panelMM);
    if (stageChanged) buildStage(cfg);
    drawArt(cfg);
    startReveal(cfg.restitch === 'slow' ? 1400 : 420);
    poseY = (stageKind === 'revolved') ? (cfg.stage === 'cuff' ? -.28 : cfg.stage === 'collar' ? -.22 : 0) : 0;
    poseUntil = performance.now() + 900;                         // face the viewer for the re-stitch
    lastPointer = performance.now();                             // and hold the pose a while
    currentCfg = { ...cfg, mono: { ...(cfg.mono || {}) } };
  },
  info() {
    return renderer ? { tris: renderer.info.render.triangles, calls: renderer.info.render.calls } : null;
  }
};
