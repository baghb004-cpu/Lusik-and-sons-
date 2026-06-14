"use client";

// ============================================================
// Event Photo Booth Builder (§30, Phase 8) — workspace
// ============================================================
// Configure a booth, try it live with the device camera (countdown →
// capture → compose → save), and export a standalone offline booth.
// Camera-first, no upload, no face recognition. localStorage config.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  boothProjectSchema, BOOTH_PRESET_LIST, makeBoothPreset, boothCanvas, photoSlots, generateBooth,
  BOOTH_LAYOUTS, FILTERS, FILTER_CSS, COUNTDOWNS, type BoothProject,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const STORE = "lusik_photobooth_current";
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "photo-booth";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function PhotoBoothBuilder() {
  const [project, setProject] = useState<BoothProject | null>(null);
  const [logo, setLogo] = useState<string>(""); // dataURL (optional)
  const [phase, setPhase] = useState<"idle" | "live" | "running" | "done">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [camMsg, setCamMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const outRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { try { const r = localStorage.getItem(STORE); if (r) setProject(boothProjectSchema.parse(JSON.parse(r))); } catch { /* */ } }, []);
  useEffect(() => { if (project) try { localStorage.setItem(STORE, JSON.stringify(project)); } catch { /* */ } }, [project]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const upd = (patch: Partial<BoothProject>) => setProject((p) => (p ? { ...p, ...patch } : p));

  async function enableCamera() {
    setCamMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setPhase("live");
    } catch { setCamMsg("Camera permission is needed (and a camera + https/localhost). You can still configure and export the booth."); }
  }

  async function runBooth() {
    if (!project || !videoRef.current || !outRef.current) return;
    setPhase("running");
    const video = videoRef.current;
    const caps: HTMLCanvasElement[] = [];
    for (let i = 0; i < photoSlots(project); i++) {
      for (let n = project.countdown; n > 0; n--) { setCount(n); await wait(1000); }
      setCount(null);
      const c = document.createElement("canvas");
      c.width = video.videoWidth || 640; c.height = video.videoHeight || 480;
      c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
      caps.push(c);
      await wait(300);
    }
    compose(caps);
    setPhase("done");
  }

  function compose(caps: HTMLCanvasElement[]) {
    if (!project || !outRef.current) return;
    const cv = boothCanvas(project);
    const out = outRef.current;
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.filter = FILTER_CSS[project.filter] || "none";
    cv.cells.forEach((cell, i) => {
      const src = caps[i]; if (!src) return;
      const s = Math.max(cell.w / src.width, cell.h / src.height);
      const sw = cell.w / s, sh = cell.h / s, sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
      ctx.drawImage(src, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
    });
    ctx.filter = "none";
    const f = cv.footer;
    ctx.fillStyle = project.brandColor; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.font = "bold 30px system-ui, sans-serif";
    const label = (project.eventName || "") + (project.eventDate ? `  ·  ${project.eventDate}` : "");
    if (label) ctx.fillText(label, f.x + 16, f.y + f.h / 2);
  }

  const savePhoto = () => { if (!project || !outRef.current) return; if (project.askBeforeSave && !confirm("Save this photo to your device?")) return; dl(dataUrlToBlob(outRef.current.toDataURL("image/png")), `photo-booth-${Date.now()}.png`); };

  const exportZip = async () => {
    if (!project) return;
    const proj = logo ? { ...project, logoUrl: "assets/logo.png" } : project;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generateBooth(proj).files)) zip.file(path, content);
    if (logo) zip.file("photo-booth/assets/logo.png", logo.slice(logo.indexOf(",") + 1), { base64: true });
    dl(await zip.generateAsync({ type: "blob" }), `${slug(project.name)}.zip`);
  };

  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">📸 Photo Booth Builder</h1>
        <p className="mt-1 text-sm text-muted">Make a fun event photo booth — countdown, capture, frame, save. Runs on this device's camera; nothing is uploaded.</p>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Pick a booth</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOOTH_PRESET_LIST.map((b) => <button key={b.key} type="button" onClick={() => setProject(makeBoothPreset(b.key))} className={`${card} text-left hover:bg-cream`}><span className="font-medium">{b.name}</span></button>)}
          </div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Use your own logo/frames — no copyrighted characters or branded assets. No face recognition or biometrics.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={project.name} onChange={(e) => upd({ name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="Booth name" />
        <button type="button" onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); setProject(null); setPhase("idle"); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New booth</button>
      </div>

      <section className={`mt-4 ${card}`}>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Settings</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs"><span className="mb-1 block text-muted">Layout</span><select value={project.layout} onChange={(e) => upd({ layout: e.target.value as BoothProject["layout"] })} className={field} aria-label="Layout">{BOOTH_LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Photos {project.layout === "strip" ? "(strip)" : ""}</span><input type="number" min={1} max={4} value={project.photoCount} onChange={(e) => upd({ photoCount: Math.min(4, Math.max(1, Number(e.target.value))) })} disabled={project.layout !== "strip"} className={field} aria-label="Photo count" /></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Countdown</span><select value={project.countdown} onChange={(e) => upd({ countdown: Number(e.target.value) })} className={field} aria-label="Countdown">{COUNTDOWNS.map((c) => <option key={c} value={c}>{c === 0 ? "Off" : `${c}s`}</option>)}</select></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Filter</span><select value={project.filter} onChange={(e) => upd({ filter: e.target.value as BoothProject["filter"] })} className={field} aria-label="Filter">{FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}</select></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Event name</span><input value={project.eventName} onChange={(e) => upd({ eventName: e.target.value })} className={field} aria-label="Event name" /></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Event date</span><input value={project.eventDate} onChange={(e) => upd({ eventDate: e.target.value })} className={field} aria-label="Event date" /></label>
          <label className="text-xs"><span className="mb-1 block text-muted">Brand color</span><input type="color" value={project.brandColor} onChange={(e) => upd({ brandColor: e.target.value })} className="h-9 w-full rounded-xl border border-ink/20" aria-label="Brand color" /></label>
          <div className="text-xs"><span className="mb-1 block text-muted">Logo (optional)</span><input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(f); } e.target.value = ""; }} /><button type="button" onClick={() => logoInput.current?.click()} className="rounded-full border border-ink/30 px-3 py-1.5">{logo ? "Logo added ✓" : "Upload logo"}</button></div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={project.askBeforeSave} onChange={(e) => upd({ askBeforeSave: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Ask before saving</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={project.retakeAllowed} onChange={(e) => upd({ retakeAllowed: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Allow retake</label>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Try it (this device's camera)</h2>
        <div className={`${card} relative`}>
          <video ref={videoRef} playsInline muted className={`w-full rounded-xl bg-black ${phase === "done" ? "hidden" : ""}`} aria-label="Camera preview" />
          <canvas ref={outRef} className={`w-full rounded-xl ${phase === "done" ? "" : "hidden"}`} />
          {count != null ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-extrabold text-white drop-shadow">{count}</div> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {phase === "idle" ? <button type="button" onClick={() => void enableCamera()} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Enable camera</button> : null}
            {phase === "live" ? <button type="button" onClick={() => void runBooth()} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Start ({photoSlots(project)} photo{photoSlots(project) > 1 ? "s" : ""})</button> : null}
            {phase === "done" ? <><button type="button" onClick={savePhoto} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Save photo</button>{project.retakeAllowed ? <button type="button" onClick={() => setPhase("live")} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">Retake</button> : null}</> : null}
            {phase === "live" || phase === "running" ? <span className="self-center text-xs font-medium text-rose-600">● camera on</span> : null}
          </div>
          {camMsg ? <p className="mt-1 text-xs text-amber-800">{camMsg}</p> : null}
        </div>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Export standalone booth (ZIP)</button>
        <button type="button" onClick={() => dl(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${slug(project.name)}-config.json`)} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config</button>
      </section>
      <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-[11px] text-muted">This booth uses the device camera only while open. Photos save locally when you tap Save — nothing is uploaded. No face recognition or biometrics. Browsers need https (or localhost) for camera access; export and host over https for phones.</p>
    </main>
  );
}

function dataUrlToBlob(u: string): Blob {
  const [head, b64] = u.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
