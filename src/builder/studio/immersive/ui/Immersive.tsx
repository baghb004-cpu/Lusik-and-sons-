"use client";

// ============================================================
// Immersive Builder (§30, Phase 2) — scroll-story workspace
// ============================================================
// Build/describe a scroll experience, edit sections, see a mobile
// performance score, and export a clean offline web page (ZIP) — or
// drop it into the website builder. Offline, localStorage.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  scrollProjectSchema, SCROLL_PRESET_LIST, makeScrollPreset, vibeScroll, scorePerformance, generateScrollSite,
  QUALITIES, SECTION_TYPES, ANIMATIONS, type ScrollProject, type Section,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const STORE = "lusik_immersive_current";
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "scroll-page";

function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function Immersive() {
  const [project, setProject] = useState<ScrollProject | null>(null);
  const [vibeText, setVibeText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [showExplain, setShowExplain] = useState(true);

  useEffect(() => {
    try { const r = localStorage.getItem(STORE); if (r) setProject(scrollProjectSchema.parse(JSON.parse(r))); } catch { /* */ }
    // A prompt seeded from the Creation Studio hub → build it immediately.
    try {
      const seed = JSON.parse(sessionStorage.getItem("lusik_studio_vibe") || "null");
      if (seed && seed.mode === "immersive" && seed.text) {
        sessionStorage.removeItem("lusik_studio_vibe");
        const rr = vibeScroll(seed.text); setNotes(rr.notes); setProject(rr.project);
      }
    } catch { /* */ }
  }, []);
  useEffect(() => { if (project) try { localStorage.setItem(STORE, JSON.stringify(project)); } catch { /* */ } }, [project]);

  const perf = useMemo(() => (project ? scorePerformance(project) : null), [project]);
  const upd = (patch: Partial<ScrollProject>) => setProject((p) => (p ? { ...p, ...patch } : p));
  const updSection = (id: string, patch: Partial<Section>) => setProject((p) => (p ? { ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : p));
  const move = (i: number, dir: -1 | 1) => setProject((p) => { if (!p) return p; const a = [...p.sections]; const j = i + dir; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, sections: a }; });

  const runVibe = (asNew: boolean) => { const r = vibeScroll(vibeText, asNew ? undefined : project ?? undefined); setNotes(r.notes); setProject(r.project); };
  const exportZip = async () => {
    if (!project) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generateScrollSite(project).files)) zip.file(path, content);
    dl(await zip.generateAsync({ type: "blob" }), `${slug(project.name)}.zip`);
  };

  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">✨ Immersive Builder</h1>
        <p className="mt-1 text-sm text-muted">Build a website (or app screen) that tells a story as people scroll — things fade, slide, float, and reveal. Optional, offline, and gentle on phones.</p>
        {showExplain ? (
          <div className={`mt-4 ${card}`}>
            <h2 className="font-display text-lg">Like a little movie 🎬</h2>
            <p className="mt-1 text-sm">Imagine your page is a storybook. As someone scrolls, new things appear, move, and change — a product floats in, text pops up, photos slide. Great for a homepage, product launch, portfolio, restaurant story, or app intro.</p>
            <p className="mt-2 text-xs text-muted">Start simple. One beautiful effect with clean text beats a slow page with too many. We keep your real text readable even with effects off.</p>
            <button type="button" onClick={() => setShowExplain(false)} className="mt-2 text-xs text-accent underline underline-offset-2">Got it</button>
          </div>
        ) : null}
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Describe it</h2>
          <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2} placeholder='e.g. "Make a cinematic homepage for a boutique where products appear as people scroll."' className={field} aria-label="Describe your page" />
          <button type="button" onClick={() => runVibe(true)} className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">Build it</button>
          {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
        </section>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Or pick a template</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCROLL_PRESET_LIST.map((p) => <button key={p.kind} type="button" onClick={() => { setProject(makeScrollPreset(p.kind)); setNotes([]); }} className={`${card} text-left hover:bg-cream`}><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.kind.replace("-", " ")}</span></button>)}
          </div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Use your own or properly licensed images — no copyrighted models, music, or logos. You own what you make.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={project.name} onChange={(e) => upd({ name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="Page name" />
        <button type="button" onClick={() => { setProject(null); setNotes([]); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New page</button>
      </div>
      <p className="mt-0.5 text-xs text-muted">{project.kind.replace("-", " ")} · {project.sections.length} sections</p>

      {perf ? (
        <div className={`mt-3 ${card} ${perf.grade === "heavy" ? "border-amber-300 bg-amber-50" : ""}`}>
          <p className="text-sm font-medium">📱 Mobile performance: {perf.score}/100 ({perf.grade})</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted">{perf.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      ) : null}

      <section className="mt-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Vibe edit</h2>
        <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2} placeholder='e.g. "add a product reveal section", "make it less heavy", "make the object spin slowly"' className={field} aria-label="Vibe edit" />
        <button type="button" onClick={() => runVibe(false)} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">Apply</button>
        {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-3">
        <div>
          <span className="mr-2 text-xs text-muted">Quality:</span>
          {QUALITIES.map((q) => <button key={q} type="button" onClick={() => upd({ quality: q })} className={`mr-1 rounded-full border px-2.5 py-1 text-xs capitalize ${project.quality === q ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{q}</button>)}
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.reducedMotionFallback} onChange={(e) => upd({ reducedMotionFallback: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Reduced-motion + mobile fallback</label>
      </section>

      <section className="mt-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Sections (revealed as the visitor scrolls)</h2>
        <ul className="space-y-2">
          {project.sections.map((s, i) => (
            <li key={s.id} className={card}>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
                <span className="capitalize">{s.type.replace("-", " ")}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} className="rounded border border-ink/20 px-1.5" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded border border-ink/20 px-1.5" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => setProject({ ...project, sections: project.sections.filter((x) => x.id !== s.id) })} className="text-red-700">Remove</button>
                </span>
              </div>
              <input value={s.heading} onChange={(e) => updSection(s.id, { heading: e.target.value })} placeholder="Heading" className={`${field} mb-1`} aria-label="Heading" />
              <textarea value={s.body} onChange={(e) => updSection(s.id, { body: e.target.value })} rows={2} placeholder="Text" className={`${field} mb-1`} aria-label="Body" />
              <div className="grid gap-1 sm:grid-cols-2">
                <select value={s.animation} onChange={(e) => updSection(s.id, { animation: e.target.value as Section["animation"] })} className={field} aria-label="Animation">{ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                <input value={s.imageUrl} onChange={(e) => updSection(s.id, { imageUrl: e.target.value })} placeholder="Image path (assets/…) — optional" className={field} aria-label="Image path" />
              </div>
            </li>
          ))}
        </ul>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">+ Add a section</summary>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SECTION_TYPES.map((t) => <button key={t} type="button" onClick={() => setProject({ ...project, sections: [...project.sections, { id: `s-${Date.now()}`, type: t, heading: "", body: "", imageUrl: "", ctaLabel: "", ctaHref: "", animation: "fade", accent: "#1A1612" }] })} className="rounded-full border border-ink/20 px-2.5 py-1 capitalize hover:bg-cream">{t.replace("-", " ")}</button>)}
          </div>
        </details>
      </section>

      <section className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Export web page (ZIP)</button>
        <button type="button" onClick={() => dl(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${slug(project.name)}-config.json`)} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config</button>
      </section>
      <p className="mt-2 text-[11px] text-muted">Open <code>index.html</code> from the ZIP in any browser, or drop the files into your website builder as a section. Works with JavaScript off; honors reduced-motion automatically.</p>
    </main>
  );
}
