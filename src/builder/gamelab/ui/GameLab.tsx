"use client";

// ============================================================
// Game Lab (§29) — offline mini-game builder workspace
// ============================================================
// Pick/describe a game, arrange it on a drag-and-drop canvas, tune each
// object in the inspector, import your own art, read the generated
// GDScript, and export a real Godot project (ZIP) or save it to the
// drive. All offline (localStorage); 2D and a simple 3D path.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PRESET_LIST, makePreset, vibe, applyDifficulty, generateProject, OBJECT_CATALOG, LOGIC_BLOCKS,
  DIFFICULTIES, type GameProject, type Difficulty, type EntityType, type Entity,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const VIEW_W = 640, VIEW_H = 360;
const TOKEN_KEY = "lusik_builder_local_token";

const read = <T,>(k: string, d: T): T => { try { const r = localStorage.getItem(k); return r != null ? (JSON.parse(r) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "game";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* */ } }} className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">{done ? "Copied ✓" : "Copy"}</button>;
}

const SETTING_LABELS: Record<string, string> = {
  playerSpeed: "Player speed", enemySpeed: "Enemy speed", jumpForce: "Jump force", gravity: "Gravity",
  scoreGoal: "Score goal", timeLimit: "Time limit (s)", playerHealth: "Player health", spawnRate: "Obstacle rate",
};

export function GameLab() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({}); // filename → dataURL
  const [templates, setTemplates] = useState<GameProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vibeText, setVibeText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [view, setView] = useState<"build" | "code" | "help">("build");
  const [saveMsg, setSaveMsg] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const m = /^#token=(.+)$/.exec(window.location.hash);
    if (m && m[1].length >= 16) { try { sessionStorage.setItem(TOKEN_KEY, m[1]); } catch { /* */ } window.history.replaceState(null, "", window.location.pathname); }
    setProject(read<GameProject | null>("lusik_gamelab_current", null));
    setAssets(read("lusik_gamelab_assets", {}));
    setTemplates(read("lusik_gamelab_templates", []));
    // A prompt seeded from the Creation Studio hub → build it immediately.
    try {
      const seed = JSON.parse(sessionStorage.getItem("lusik_studio_vibe") || "null");
      if (seed && seed.mode === "game-lab" && seed.text) {
        sessionStorage.removeItem("lusik_studio_vibe");
        const r = vibe(seed.text);
        setNotes(r.notes);
        if (r.ok && r.project) { setProject(r.project); setSelectedId(null); }
      }
    } catch { /* */ }
  }, []);
  useEffect(() => { if (project) write("lusik_gamelab_current", project); }, [project]);
  useEffect(() => { write("lusik_gamelab_assets", assets); }, [assets]);

  const generated = useMemo(() => (project ? generateProject(project) : null), [project]);
  const selected = project?.entities.find((e) => e.id === selectedId) ?? null;

  const update = useCallback((patch: Partial<GameProject>) => setProject((p) => (p ? { ...p, ...patch } : p)), []);
  const updateEntity = (id: string, patch: Partial<Entity>) => setProject((p) => (p ? { ...p, entities: p.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : p));

  const runVibe = (asNew: boolean) => {
    const r = vibe(vibeText, asNew ? undefined : project ?? undefined);
    setNotes(r.notes);
    if (r.ok && r.project) { setProject(r.project); setSelectedId(null); }
  };

  // ---- canvas drag ----
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const onEntityDown = (e: Entity) => (ev: React.PointerEvent) => {
    ev.preventDefault();
    setSelectedId(e.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((ev.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((ev.clientY - rect.top) / rect.height) * VIEW_H;
    dragRef.current = { id: e.id, offX: px - e.x, offY: py - e.y };
    const move = (m: PointerEvent) => {
      const d = dragRef.current; const r = canvasRef.current?.getBoundingClientRect();
      if (!d || !r) return;
      const nx = ((m.clientX - r.left) / r.width) * VIEW_W - d.offX;
      const ny = ((m.clientY - r.top) / r.height) * VIEW_H - d.offY;
      updateEntity(d.id, { x: Math.max(0, Math.round(nx)), y: Math.max(0, Math.round(ny)) });
    };
    const up = () => { dragRef.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- assets ----
  const importImage = (file: File) => {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = `${selected.type}-${Date.now()}.${ext}`;
      setAssets((a) => ({ ...a, [name]: dataUrl }));
      updateEntity(selected.id, { props: { ...selected.props, sprite: name } });
    };
    reader.readAsDataURL(file);
  };
  const dataUrlToBase64 = (u: string) => u.slice(u.indexOf(",") + 1);

  // ---- export ----
  const exportZip = async () => {
    if (!generated || !project) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generated.files)) zip.file(path, content);
    for (const e of project.entities) {
      const s = typeof e.props.sprite === "string" ? e.props.sprite : "";
      if (s && assets[s]) zip.file(`game-project/assets/${s}`, dataUrlToBase64(assets[s]), { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    dl(blob, `${slug(project.name)}-godot.zip`);
  };
  const saveToDrive = async () => {
    if (!project) return;
    setSaveMsg("Saving to the drive…");
    const usedAssets: Record<string, string> = {};
    for (const e of project.entities) { const s = typeof e.props.sprite === "string" ? e.props.sprite : ""; if (s && assets[s]) usedAssets[s] = dataUrlToBase64(assets[s]); }
    try {
      const token = sessionStorage.getItem(TOKEN_KEY) || "";
      const res = await fetch("/api/builder/gamelab", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ project, assets: usedAssets }) });
      const body = await res.json().catch(() => null);
      setSaveMsg(res.ok ? `✅ Saved to ${body.path}` : `⚠️ ${body?.error || "Could not save"} ${body?.hint ?? ""}`);
    } catch { setSaveMsg("⚠️ Saving to the drive needs the Workshop launcher (offline). Use Download ZIP instead."); }
  };
  const saveTemplate = () => {
    if (!project) return;
    const copy = { ...project, id: `tpl-${Date.now()}` };
    setTemplates((t) => { const next = [copy, ...t].slice(0, 30); write("lusik_gamelab_templates", next); return next; });
    setSaveMsg("✅ Saved as a template below.");
  };

  // ---------- dashboard ----------
  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">🕹️ Game Lab</h1>
        <p className="mt-1 text-sm text-muted">Make a small original game and export a real Godot project you own. Fully offline — no cloud, no royalties.</p>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Describe it (vibe build)</h2>
          <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2} placeholder='e.g. "Make a platformer where the player collects 10 coins and avoids spikes."' className={field} aria-label="Describe your game" />
          <button type="button" onClick={() => runVibe(true)} className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">Build it</button>
          {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
        </section>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Or start from a preset</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESET_LIST.map((p) => (
              <button key={p.kind} type="button" onClick={() => { setProject(makePreset(p.kind)); setNotes([]); setSelectedId(null); }} className={`${card} text-left hover:bg-cream`}>
                <span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.kind.replace("-", " ")}</span>
              </button>
            ))}
          </div>
        </section>
        {templates.length ? (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Your saved games</h2>
            <ul className="space-y-1">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-2 py-1 text-sm">
                  <button type="button" className="text-left hover:underline" onClick={() => { setProject({ ...t, id: `game-${Date.now()}` }); setSelectedId(null); }}>{t.name} <span className="text-xs text-muted">({t.kind})</span></button>
                  <button type="button" onClick={() => setTemplates((p) => { const n = p.filter((x) => x.id !== t.id); write("lusik_gamelab_templates", n); return n; })} className="text-xs text-red-700">Delete</button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-6 text-[11px] text-muted">Game Lab makes original games only — it won't copy existing games, characters, or logos. You own what you make.</p>
      </main>
    );
  }

  const settingKeys = Object.keys(project.settings).filter((k) => k in SETTING_LABELS);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={project.name} onChange={(e) => update({ name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="Game name" />
        <button type="button" onClick={() => { setProject(null); setNotes([]); setSelectedId(null); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New game</button>
      </div>
      <p className="mt-0.5 text-xs text-muted">{project.kind.replace("-", " ")} · {project.entities.length} objects · {project.rules.length} rules</p>

      <div className="mt-3 flex items-center gap-1.5">
        {(["build", "code", "help"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full border px-3 py-1 text-xs ${view === v ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{v === "build" ? "Build" : v === "code" ? "Code" : "Help & licenses"}</button>
        ))}
        <span className="ml-auto flex gap-1">
          {(["2d", "3d"] as const).map((d) => (
            <button key={d} type="button" onClick={() => update({ dimension: d })} className={`rounded-full border px-3 py-1 text-xs uppercase ${project.dimension === d ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{d}</button>
          ))}
        </span>
      </div>

      {view === "build" ? (
        <>
          {/* canvas */}
          <section className="mt-4">
            <div ref={canvasRef} onPointerDown={(e) => { if (e.target === canvasRef.current) setSelectedId(null); }} className="relative w-full overflow-hidden rounded-xl border border-ink/15 bg-slate-800" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }} role="application" aria-label="Game scene">
              {project.entities.map((e) => {
                const sprite = typeof e.props.sprite === "string" ? e.props.sprite : "";
                return (
                  <div key={e.id} onPointerDown={onEntityDown(e)} title={`${e.name} (${e.type})`}
                    className={`absolute cursor-move touch-none ${selectedId === e.id ? "ring-2 ring-amber-300" : ""}`}
                    style={{ left: `${(e.x / VIEW_W) * 100}%`, top: `${(e.y / VIEW_H) * 100}%`, width: `${(e.w / VIEW_W) * 100}%`, height: `${(e.h / VIEW_H) * 100}%`, background: sprite && assets[sprite] ? `center/cover url(${assets[sprite]})` : e.color }} />
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted">{project.dimension === "3d" ? "3D: this top-down layout becomes the ground plane (x/z)." : "Drag objects to place them. Tap one to edit it."}</p>
          </section>

          {/* inspector */}
          {selected ? (
            <section className={`mt-3 ${card}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-base">{selected.name} <span className="text-xs text-muted">({selected.type})</span></h2>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { const c: Entity = { ...selected, id: `${selected.type}-${Date.now()}`, x: selected.x + 24, y: selected.y + 24, props: { ...selected.props } }; setProject({ ...project, entities: [...project.entities, c] }); setSelectedId(c.id); }} className="text-xs text-accent underline underline-offset-2">Duplicate</button>
                  <button type="button" onClick={() => { setProject({ ...project, entities: project.entities.filter((e) => e.id !== selected.id) }); setSelectedId(null); }} className="text-xs text-red-700">Delete</button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs"><span className="mb-1 block text-muted">Name</span><input value={selected.name} onChange={(e) => updateEntity(selected.id, { name: e.target.value })} className={field} aria-label="Object name" /></label>
                <label className="block text-xs"><span className="mb-1 block text-muted">Color</span><input type="color" value={selected.color} onChange={(e) => updateEntity(selected.id, { color: e.target.value })} className="h-9 w-full rounded-xl border border-ink/20" aria-label="Color" /></label>
                <label className="block text-xs"><span className="mb-1 block text-muted">X</span><input type="number" value={selected.x} onChange={(e) => updateEntity(selected.id, { x: Number(e.target.value) })} className={field} aria-label="X" /></label>
                <label className="block text-xs"><span className="mb-1 block text-muted">Y</span><input type="number" value={selected.y} onChange={(e) => updateEntity(selected.id, { y: Number(e.target.value) })} className={field} aria-label="Y" /></label>
                <label className="block text-xs"><span className="mb-1 block text-muted">Width</span><input type="number" value={selected.w} onChange={(e) => updateEntity(selected.id, { w: Math.max(1, Number(e.target.value)) })} className={field} aria-label="Width" /></label>
                <label className="block text-xs"><span className="mb-1 block text-muted">Height</span><input type="number" value={selected.h} onChange={(e) => updateEntity(selected.id, { h: Math.max(1, Number(e.target.value)) })} className={field} aria-label="Height" /></label>
                {Object.entries(selected.props).filter(([k, v]) => k !== "sprite" && typeof v === "number").map(([k, v]) => (
                  <label key={k} className="block text-xs"><span className="mb-1 block capitalize text-muted">{k}</span><input type="number" value={Number(v)} onChange={(e) => updateEntity(selected.id, { props: { ...selected.props, [k]: Number(e.target.value) } })} className={field} aria-label={k} /></label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ""; }} />
                <button type="button" onClick={() => imgInputRef.current?.click()} className="rounded-full border border-ink/30 px-3 py-1 text-xs">Import image…</button>
                {typeof selected.props.sprite === "string" && selected.props.sprite ? <button type="button" onClick={() => { const { sprite: _s, ...rest } = selected.props; updateEntity(selected.id, { props: rest }); }} className="text-xs text-red-700">Use placeholder</button> : <span className="text-[11px] text-muted">Placeholder shape (license-safe)</span>}
              </div>
            </section>
          ) : null}

          {/* vibe + difficulty */}
          <section className="mt-4">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Vibe edit</h2>
            <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2} placeholder='e.g. "make the enemy slower", "add a health bar", "make it harder"' className={field} aria-label="Vibe edit" />
            <button type="button" onClick={() => runVibe(false)} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">Apply</button>
            {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
          </section>
          <section className="mt-4">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Difficulty</h2>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => <button key={d} type="button" onClick={() => setProject(applyDifficulty(project, d as Difficulty))} className={`min-h-8 rounded-full border px-3 text-xs capitalize ${project.difficulty === d ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{d}</button>)}
            </div>
          </section>
          {settingKeys.length ? (
            <section className="mt-4">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Settings</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {settingKeys.map((k) => <label key={k} className="block text-sm"><span className="mb-1 block text-xs text-muted">{SETTING_LABELS[k]}</span><input type="number" value={Number(project.settings[k])} onChange={(e) => update({ settings: { ...project.settings, [k]: Number(e.target.value) }, difficulty: "custom" })} className={field} aria-label={SETTING_LABELS[k]} /></label>)}
              </div>
            </section>
          ) : null}

          {/* add objects + rules */}
          <section className="mt-4">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Add an object</h2>
            <div className="flex flex-wrap gap-1.5">
              {OBJECT_CATALOG.map((o) => <button key={o.type} type="button" onClick={() => { const c: Entity = { id: `${o.type}-${Date.now()}`, type: o.type as EntityType, name: o.label, x: 120, y: 180, w: o.w, h: o.h, color: o.color, props: { ...(o.defaultProps ?? {}) } }; setProject({ ...project, entities: [...project.entities, c] }); setSelectedId(c.id); }} className="rounded-full border border-ink/20 px-2.5 py-1 text-xs hover:bg-cream">+ {o.label}</button>)}
            </div>
          </section>
          <section className="mt-4">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Rules</h2>
            <ul className="space-y-1 text-sm">
              {project.rules.map((r) => <li key={r.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-2 py-1"><span className="text-xs">{LOGIC_BLOCKS.find((b) => b.when === r.when && b.then === r.then)?.label ?? `${r.when} → ${r.then}`}</span><button type="button" onClick={() => setProject({ ...project, rules: project.rules.filter((x) => x.id !== r.id) })} className="text-xs text-red-700">Remove</button></li>)}
            </ul>
          </section>

          {/* export */}
          <section className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Download Godot project (ZIP)</button>
            <button type="button" onClick={() => void saveToDrive()} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Save to drive</button>
            <button type="button" onClick={saveTemplate} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Save as template</button>
          </section>
          {saveMsg ? <p className="mt-2 text-xs" data-testid="save-msg">{saveMsg}</p> : null}
          <p className="mt-1 text-[11px] text-muted">Open the ZIP in Godot 4 (free) and press Play. {project.dimension === "3d" ? "3D: arrow keys walk on the ground plane." : "Arrow keys move; Space/Enter jumps or acts."}</p>
        </>
      ) : null}

      {view === "code" && generated ? (
        <section className="mt-4">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-xs font-medium uppercase tracking-wide text-muted">scripts/Main.gd (yours to edit)</h2><CopyButton text={generated.files["game-project/scripts/Main.gd"]} /></div>
          <p className="mb-2 text-xs text-muted">This commented GDScript builds your game from the settings above. Read it, change a number, see what happens — that's how you learn.</p>
          <pre className="max-h-[60vh] overflow-auto rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-[11px] leading-relaxed"><code>{generated.files["game-project/scripts/Main.gd"]}</code></pre>
        </section>
      ) : null}

      {view === "help" ? (
        <section className="mt-4 space-y-3 text-sm">
          <div className={card}>
            <h2 className="font-display text-lg">Make your first game</h2>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs"><li>Pick a preset (or describe one).</li><li>Drag objects on the canvas; tap one to edit it.</li><li>Vibe-edit: “add a health bar”, “make it easier”.</li><li>Download the Godot project (ZIP) — or Save to drive.</li><li>Install Godot 4 (free), open the folder, press Play.</li><li>Import your own art per object to replace the placeholders.</li></ol>
          </div>
          <div className={card}>
            <h2 className="font-display text-lg">Licenses & ownership</h2>
            <ul className="mt-1 list-disc pl-5 text-xs"><li><strong>Engine:</strong> Godot (MIT) — free, royalty-free.</li><li><strong>Placeholders:</strong> plain shapes — nothing copyrighted.</li><li><strong>Your content:</strong> art/audio you import is yours to license.</li><li><strong>Your game:</strong> the exported project is 100% yours.</li><li><strong>Keep it original:</strong> no names, characters, maps, or logos from existing games.</li></ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function dl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
