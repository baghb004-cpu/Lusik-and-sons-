"use client";

// ============================================================
// Sensor Interaction Builder (§30, Phase 7) — workspace
// ============================================================
// Configure opt-in device motion, test it live (with a permission
// gate + a non-motion fallback always present), and export a
// framework-free motion module. Offline; no sensor data is stored.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  sensorProfileSchema, SENSOR_PRESET_LIST, makeSensorPreset, generateSensorModule, SENSOR_DISCLOSURE,
  tiltToVector, smooth, type SensorProfile, type Vec2,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const STORE = "lusik_sensors_current";
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sensor-module";
function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

interface OrientEvent { beta: number | null; gamma: number | null }

export function SensorsBuilder() {
  const [profile, setProfile] = useState<SensorProfile | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Motion is optional — the buttons always work.");
  const [pos, setPos] = useState<Vec2>({ x: 0, y: 0 });
  const posRef = useRef<Vec2>({ x: 0, y: 0 });
  const profRef = useRef<SensorProfile | null>(null);

  useEffect(() => { try { const r = localStorage.getItem(STORE); if (r) setProfile(sensorProfileSchema.parse(JSON.parse(r))); } catch { /* */ } }, []);
  useEffect(() => { profRef.current = profile; if (profile) try { localStorage.setItem(STORE, JSON.stringify(profile)); } catch { /* */ } }, [profile]);
  useEffect(() => () => { window.removeEventListener("deviceorientation", onOrient, true); }, []);

  const upd = (patch: Partial<SensorProfile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  function onOrient(e: Event) {
    const o = e as unknown as OrientEvent;
    const p = profRef.current; if (!p) return;
    const v = tiltToVector({ beta: o.beta ?? 0, gamma: o.gamma ?? 0 }, p);
    const next = smooth(posRef.current, v, p.smoothing);
    posRef.current = next; setPos(next);
  }

  async function start() {
    const p = profRef.current; if (!p) return;
    if (p.respectReducedMotion && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStatus("Reduced motion is on in your settings — motion stays off. Use the buttons."); return; }
    try {
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") { const res = await DOE.requestPermission(); if (res !== "granted") { setStatus("Permission denied — use the buttons instead."); return; } }
      if (!("DeviceOrientationEvent" in window)) { setStatus("No motion sensors on this device — use the buttons."); return; }
      window.addEventListener("deviceorientation", onOrient, true);
      setRunning(true); setStatus("Motion on — tilt your phone. (Desktop has no tilt; use the buttons.)");
    } catch { setStatus("Couldn't start motion — use the buttons."); }
  }
  function stop() { window.removeEventListener("deviceorientation", onOrient, true); setRunning(false); setStatus("Motion off. The buttons always work."); }
  function nudge(dx: number, dy: number) { const n = { x: Math.max(-1, Math.min(1, posRef.current.x + dx)), y: Math.max(-1, Math.min(1, posRef.current.y + dy)) }; posRef.current = n; setPos(n); }

  const exportZip = async () => {
    if (!profile) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generateSensorModule(profile).files)) zip.file(path, content);
    dl(await zip.generateAsync({ type: "blob" }), `${slug(profile.name)}.zip`);
  };

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">🎛️ Sensor Builder</h1>
        <p className="mt-1 text-sm text-muted">Add optional phone-motion controls — tilt to look, tilt to move, shake to start. Always with on-screen fallback controls, and off by default. Offline & private.</p>
        <section className="mt-6"><h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Pick a starting point</h2>
          <div className="grid gap-2 sm:grid-cols-2">{SENSOR_PRESET_LIST.map((s) => <button key={s.key} type="button" onClick={() => setProfile(makeSensorPreset(s.key))} className={`${card} text-left hover:bg-cream`}><span className="font-medium">{s.name}</span></button>)}</div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Sensors are opt-in, never used for tracking, and never required — there's always a non-motion way to use it.</p>
      </main>
    );
  }

  const slider = (label: string, key: keyof SensorProfile, min: number, max: number, step: number) => (
    <label className="block text-xs"><span className="mb-1 flex justify-between text-muted"><span>{label}</span><span className="tabular-nums">{String(profile[key])}</span></span>
      <input type="range" min={min} max={max} step={step} value={Number(profile[key])} onChange={(e) => upd({ [key]: Number(e.target.value) } as Partial<SensorProfile>)} className="w-full accent-ink" aria-label={label} /></label>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={profile.name} onChange={(e) => upd({ name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="Profile name" />
        <button type="button" onClick={() => { stop(); setProfile(null); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New profile</button>
      </div>

      <section className={`mt-4 ${card}`}>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Settings</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={profile.enableGyro} onChange={(e) => upd({ enableGyro: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Tilt (gyroscope)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={profile.enableAccel} onChange={(e) => upd({ enableAccel: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Shake (accelerometer)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={profile.invertX} onChange={(e) => upd({ invertX: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Invert X</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={profile.invertY} onChange={(e) => upd({ invertY: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Invert Y</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={profile.respectReducedMotion} onChange={(e) => upd({ respectReducedMotion: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Respect reduced-motion</label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {slider("Sensitivity", "sensitivity", 0.1, 3, 0.1)}
          {slider("Smoothing", "smoothing", 0, 0.95, 0.05)}
          {slider("Dead zone", "deadZone", 0, 0.5, 0.01)}
          {slider("Shake threshold", "shakeThreshold", 5, 40, 1)}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Test it</h2>
        <div className={`${card}`}>
          <div className="relative mx-auto h-56 overflow-hidden rounded-xl border border-ink/15 bg-slate-800">
            <div className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full bg-sky-400" style={{ transform: `translate(calc(-50% + ${pos.x * 45}%), calc(-50% + ${pos.y * 45}%))`, transition: "transform .05s linear" }} aria-hidden />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!running ? <button type="button" onClick={() => void start()} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Use motion</button> : <button type="button" onClick={stop} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">Stop motion</button>}
            <span className="text-xs text-muted">{status}</span>
          </div>
          <div className="mt-2 text-center text-xs">
            <span className="text-muted">Manual controls (always available): </span>
            <button type="button" onClick={() => nudge(0, -0.2)} className="rounded border border-ink/20 px-2">▲</button>
            <button type="button" onClick={() => nudge(-0.2, 0)} className="rounded border border-ink/20 px-2">◀</button>
            <button type="button" onClick={() => nudge(0.2, 0)} className="rounded border border-ink/20 px-2">▶</button>
            <button type="button" onClick={() => nudge(0, 0.2)} className="rounded border border-ink/20 px-2">▼</button>
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Export motion module (ZIP)</button>
        <button type="button" onClick={() => dl(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }), `${slug(profile.name)}-config.json`)} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config</button>
      </section>
      <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-[11px] text-muted">{SENSOR_DISCLOSURE}</p>
    </main>
  );
}
