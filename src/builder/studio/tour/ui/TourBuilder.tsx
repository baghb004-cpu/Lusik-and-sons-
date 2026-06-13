"use client";

// ============================================================
// Virtual Tour Builder (§30, Phase 6) — workspace
// ============================================================
// Build a 360 photo/video tour: upload equirectangular media, set the
// start view, add hotspots + scene links, preview it live (the bundled
// offline WebGL viewer in an iframe), and export a standalone tour.
// 100% offline; your media stays on this device.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  tourProjectSchema, TOUR_PRESET_LIST, makeTourPreset, generateTour, inlineTourHtml,
  HOTSPOT_KINDS, type TourProject, type Scene360, type Hotspot,
} from "../index.ts";

const cardCls = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const PROJ = "lusik_tour_current";
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "virtual-tour";
const b64 = (u: string) => u.slice(u.indexOf(",") + 1);
function dlBlob(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function TourBuilder() {
  const [project, setProject] = useState<TourProject | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({}); // filename → dataURL
  const [activeId, setActiveId] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try { const r = localStorage.getItem(PROJ); if (r) { const p = tourProjectSchema.parse(JSON.parse(r)); setProject(p); setActiveId(p.scenes[0]?.id || ""); } } catch { /* */ }
    try { const a = localStorage.getItem("lusik_tour_assets"); if (a) setAssets(JSON.parse(a)); } catch { /* */ }
  }, []);
  useEffect(() => { if (project) try { localStorage.setItem(PROJ, JSON.stringify(project)); } catch { /* */ } }, [project]);
  useEffect(() => { try { localStorage.setItem("lusik_tour_assets", JSON.stringify(assets)); } catch { /* */ } }, [assets]);

  const active = project?.scenes.find((s) => s.id === activeId) ?? project?.scenes[0] ?? null;
  const previewHtml = useMemo(() => (project ? inlineTourHtml(project, assets) : ""), [project, assets]);

  const upd = (patch: Partial<TourProject>) => setProject((p) => (p ? { ...p, ...patch } : p));
  const updScene = (id: string, patch: Partial<Scene360>) => setProject((p) => (p ? { ...p, scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : p));
  const updHot = (sid: string, hid: string, patch: Partial<Hotspot>) => updScene(sid, { hotspots: (active?.hotspots ?? []).map((h) => (h.id === hid ? { ...h, ...patch } : h)) });

  const uploadMedia = (file: File) => {
    if (!active) return;
    const r = new FileReader();
    r.onload = () => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${active.id}.${ext}`;
      setAssets((a) => ({ ...a, [name]: String(r.result) }));
      updScene(active.id, { src: name, mediaType: file.type.startsWith("video") ? "video" : "photo" });
    };
    r.readAsDataURL(file);
  };

  const exportZip = async () => {
    if (!project) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generateTour(project).files)) zip.file(path, content);
    for (const s of project.scenes) { if (s.src && assets[s.src]) zip.file(`virtual-tour/assets/${s.src}`, b64(assets[s.src]), { base64: true }); }
    dlBlob(await zip.generateAsync({ type: "blob" }), `${slug(project.name)}.zip`);
  };

  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">🧭 Virtual Tour Builder</h1>
        <p className="mt-1 text-sm text-muted">Turn your 360 photos and videos into a tour visitors can look around in — with hotspots and scene links. Fully offline; the viewer needs no internet or libraries.</p>
        <section className="mt-6"><h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Start a tour</h2>
          <div className="grid gap-2 sm:grid-cols-3">{TOUR_PRESET_LIST.map((t) => <button key={t.key} type="button" onClick={() => { const p = makeTourPreset(t.key)!; setProject(p); setActiveId(p.scenes[0].id); }} className={`${cardCls} text-left hover:bg-cream`}><span className="font-medium">{t.name}</span></button>)}</div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Use your own or properly licensed equirectangular 360 media — no copyrighted videos, music, or maps.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={project.name} onChange={(e) => upd({ name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="Tour name" />
        <button type="button" onClick={() => setProject(null)} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New tour</button>
      </div>

      {/* live preview */}
      <section className="mt-4">
        <div className="overflow-hidden rounded-xl border border-ink/15 bg-black" style={{ aspectRatio: "16 / 9" }}>
          {active?.src && assets[active.src] ? <iframe title="360 preview" srcDoc={previewHtml} className="h-full w-full border-0" /> : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">Upload a 360 photo for this scene to preview it.</div>}
        </div>
        <p className="mt-1 text-[11px] text-muted">Drag inside the preview to look around. Hotspots show live as you set their yaw/pitch.</p>
      </section>

      {/* scenes */}
      <section className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {project.scenes.map((s) => <button key={s.id} type="button" onClick={() => setActiveId(s.id)} className={`rounded-full border px-3 py-1 text-xs ${s.id === active?.id ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{s.name}</button>)}
          <button type="button" onClick={() => { const s: Scene360 = { id: `scene-${Date.now()}`, name: `Scene ${project.scenes.length + 1}`, mediaType: "photo", src: "", startYaw: 0, startPitch: 0, autoplay: false, loop: true, hotspots: [] }; setProject({ ...project, scenes: [...project.scenes, s] }); setActiveId(s.id); }} className="rounded-full border border-ink/30 px-3 py-1 text-xs">+ Scene</button>
        </div>
        {active ? (
          <div className={cardCls}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs"><span className="mb-1 block text-muted">Scene name</span><input value={active.name} onChange={(e) => updScene(active.id, { name: e.target.value })} className={field} aria-label="Scene name" /></label>
              <div className="text-xs"><span className="mb-1 block text-muted">360 media</span><input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.target.value = ""; }} /><button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-ink/30 px-3 py-1.5">{active.src ? `${active.src} ✓` : "Upload 360 photo/video"}</button></div>
              <label className="text-xs"><span className="mb-1 block text-muted">Start yaw (°)</span><input type="number" value={active.startYaw} onChange={(e) => updScene(active.id, { startYaw: Number(e.target.value) })} className={field} aria-label="Start yaw" /></label>
              <label className="text-xs"><span className="mb-1 block text-muted">Start pitch (°)</span><input type="number" value={active.startPitch} onChange={(e) => updScene(active.id, { startPitch: Math.max(-89, Math.min(89, Number(e.target.value))) })} className={field} aria-label="Start pitch" /></label>
            </div>
            {project.scenes.length > 1 ? <button type="button" onClick={() => { const rest = project.scenes.filter((s) => s.id !== active.id); setProject({ ...project, scenes: rest }); setActiveId(rest[0].id); }} className="mt-2 text-xs text-red-700">Delete scene</button> : null}

            {/* hotspots */}
            <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Hotspots</h3>
            <ul className="mt-1 space-y-2">
              {active.hotspots.map((h) => (
                <li key={h.id} className="rounded-xl border border-ink/10 p-2">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <input value={h.label} onChange={(e) => updHot(active.id, h.id, { label: e.target.value })} placeholder="Label" className={field} aria-label="Hotspot label" />
                    <select value={h.kind} onChange={(e) => updHot(active.id, h.id, { kind: e.target.value as Hotspot["kind"] })} className={field} aria-label="Hotspot kind">{HOTSPOT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                    <label className="text-xs"><span className="text-muted">yaw</span><input type="number" value={h.yaw} onChange={(e) => updHot(active.id, h.id, { yaw: Number(e.target.value) })} className={field} aria-label="Hotspot yaw" /></label>
                    <label className="text-xs"><span className="text-muted">pitch</span><input type="number" value={h.pitch} onChange={(e) => updHot(active.id, h.id, { pitch: Math.max(-89, Math.min(89, Number(e.target.value))) })} className={field} aria-label="Hotspot pitch" /></label>
                    {h.kind === "scene" ? (
                      <select value={h.targetSceneId} onChange={(e) => updHot(active.id, h.id, { targetSceneId: e.target.value })} className={field} aria-label="Target scene"><option value="">Pick a scene…</option>{project.scenes.filter((s) => s.id !== active.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    ) : (
                      <input value={h.text} onChange={(e) => updHot(active.id, h.id, { text: e.target.value })} placeholder={h.kind === "link" ? "https://…" : "Info text"} className={field} aria-label="Hotspot text" />
                    )}
                  </div>
                  <button type="button" onClick={() => updScene(active.id, { hotspots: active.hotspots.filter((x) => x.id !== h.id) })} className="mt-1 text-xs text-red-700">Remove</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => updScene(active.id, { hotspots: [...active.hotspots, { id: `h-${Date.now()}`, yaw: 0, pitch: 0, label: "New", kind: "info", text: "", targetSceneId: "" }] })} className="mt-2 rounded-full border border-ink/20 px-3 py-1 text-xs">+ Hotspot</button>
          </div>
        ) : null}
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs"><span className="mr-2 text-muted">Field of view</span><input type="range" min={40} max={110} value={project.fov} onChange={(e) => upd({ fov: Number(e.target.value) })} className="align-middle accent-ink" aria-label="Field of view" /> <span className="tabular-nums">{project.fov}°</span></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.enableGyro} onChange={(e) => upd({ enableGyro: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Offer gyroscope</label>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Export tour (ZIP)</button>
        <button type="button" onClick={() => dlBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${slug(project.name)}-config.json`)} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config</button>
      </section>
      <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-[11px] text-muted">The exported tour bundles a tiny WebGL viewer — no internet or libraries needed. Host it over http(s) so browsers allow the 360 texture. Use only media you have the rights to.</p>
    </main>
  );
}
