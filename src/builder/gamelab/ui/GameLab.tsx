"use client";

// ============================================================
// Game Lab (§29) — the offline mini-game builder workspace
// ============================================================
// Pick a preset (or describe it), tweak objects/settings/rules,
// vibe-edit in plain English, read the generated GDScript, and export
// a real Godot project — all offline, in the browser (localStorage).
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  PRESET_LIST, makePreset, vibe, applyDifficulty, generateProject, OBJECT_CATALOG, LOGIC_BLOCKS,
  DIFFICULTIES, type GameProject, type Difficulty, type EntityType,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const STORE = "lusik_gamelab_current";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }} className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

const SETTING_LABELS: Record<string, string> = {
  playerSpeed: "Player speed", enemySpeed: "Enemy speed", jumpForce: "Jump force", gravity: "Gravity",
  scoreGoal: "Score goal", timeLimit: "Time limit (s)", playerHealth: "Player health", spawnRate: "Obstacle rate",
};

export function GameLab() {
  const [project, setProject] = useState<GameProject | null>(null);
  const [vibeText, setVibeText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [view, setView] = useState<"build" | "code" | "help">("build");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setProject(JSON.parse(raw) as GameProject);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (project) try { localStorage.setItem(STORE, JSON.stringify(project)); } catch { /* ignore */ }
  }, [project]);

  const generated = useMemo(() => (project ? generateProject(project) : null), [project]);

  const runVibe = (asNew: boolean) => {
    const r = vibe(vibeText, asNew ? undefined : project ?? undefined);
    setNotes(r.notes);
    if (r.ok && r.project) setProject(r.project);
  };

  const downloadZip = async () => {
    if (!generated) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generated.files)) zip.file(path, content);
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `${(project?.name ?? "game").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-godot.zip`);
  };
  const downloadConfig = () => {
    if (!project) return;
    triggerDownload(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-config.json`);
  };

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
              <button key={p.kind} type="button" onClick={() => { setProject(makePreset(p.kind)); setNotes([]); }} className={`${card} text-left hover:bg-cream`}>
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-muted">{p.kind.replace("-", " ")}</span>
              </button>
            ))}
          </div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Game Lab makes original games only — it won't copy existing games, characters, or logos. You own what you make.</p>
      </main>
    );
  }

  const settingKeys = Object.keys(project.settings).filter((k) => k in SETTING_LABELS);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} className="font-display text-2xl bg-transparent focus:outline-none" aria-label="Game name" />
        <button type="button" onClick={() => { setProject(null); setNotes([]); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New game</button>
      </div>
      <p className="mt-0.5 text-xs text-muted">{project.kind.replace("-", " ")} · {project.entities.length} objects · {project.rules.length} rules</p>

      <div className="mt-3 flex gap-1.5">
        {(["build", "code", "help"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full border px-3 py-1 text-xs ${view === v ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{v === "build" ? "Build" : v === "code" ? "Code" : "Help & licenses"}</button>
        ))}
      </div>

      {view === "build" ? (
        <>
          <section className="mt-4">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Vibe edit</h2>
            <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2} placeholder='e.g. "make the enemy slower", "add a health bar", "make it harder"' className={field} aria-label="Vibe edit" />
            <button type="button" onClick={() => runVibe(false)} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">Apply</button>
            {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
          </section>

          <section className="mt-5">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Difficulty</h2>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button key={d} type="button" onClick={() => setProject(applyDifficulty(project, d as Difficulty))} className={`min-h-8 rounded-full border px-3 text-xs capitalize ${project.difficulty === d ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{d}</button>
              ))}
            </div>
          </section>

          {settingKeys.length ? (
            <section className="mt-5">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Settings</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {settingKeys.map((k) => (
                  <label key={k} className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">{SETTING_LABELS[k]}</span>
                    <input type="number" value={Number(project.settings[k])} onChange={(e) => setProject({ ...project, settings: { ...project.settings, [k]: Number(e.target.value) }, difficulty: "custom" })} className={field} aria-label={SETTING_LABELS[k]} />
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Objects</h2>
            <ul className="space-y-1">
              {project.entities.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-2 py-1 text-sm">
                  <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded" style={{ background: e.color }} aria-hidden /> {e.name} <span className="text-xs text-muted">({e.type})</span></span>
                  <button type="button" onClick={() => setProject({ ...project, entities: project.entities.filter((x) => x.id !== e.id) })} className="text-xs text-red-700">Remove</button>
                </li>
              ))}
            </ul>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted">+ Add an object</summary>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {OBJECT_CATALOG.map((o) => (
                  <button key={o.type} type="button" onClick={() => setProject({ ...project, entities: [...project.entities, { id: `${o.type}-${Date.now()}`, type: o.type as EntityType, name: o.label, x: 120, y: 200, w: o.w, h: o.h, color: o.color, props: { ...(o.defaultProps ?? {}) } }] })} className="rounded-full border border-ink/20 px-2.5 py-1 hover:bg-cream">{o.label}</button>
                ))}
              </div>
            </details>
          </section>

          <section className="mt-5">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Rules (logic blocks)</h2>
            <ul className="space-y-1 text-sm">
              {project.rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-2 py-1">
                  <span className="text-xs">{LOGIC_BLOCKS.find((b) => b.when === r.when && b.then === r.then)?.label ?? `${r.when} → ${r.then}`}</span>
                  <button type="button" onClick={() => setProject({ ...project, rules: project.rules.filter((x) => x.id !== r.id) })} className="text-xs text-red-700">Remove</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => void downloadZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Download Godot project (ZIP)</button>
            <button type="button" onClick={downloadConfig} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config (JSON)</button>
          </section>
          <p className="mt-2 text-[11px] text-muted">Open the ZIP in Godot 4 (free) and press Play. Arrow keys move; Space/Enter jumps or acts.</p>
        </>
      ) : null}

      {view === "code" && generated ? (
        <section className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">scripts/Main.gd (yours to edit)</h2>
            <CopyButton text={generated.files["game-project/scripts/Main.gd"]} />
          </div>
          <p className="mb-2 text-xs text-muted">This one commented GDScript file builds your level from the settings above and runs the rules. It's the best way to learn — read the comments, change a number, see what happens.</p>
          <pre className="max-h-[60vh] overflow-auto rounded-xl border border-ink/10 bg-ink/[0.03] p-3 text-[11px] leading-relaxed"><code>{generated.files["game-project/scripts/Main.gd"]}</code></pre>
        </section>
      ) : null}

      {view === "help" ? (
        <section className="mt-4 space-y-3 text-sm">
          <div className={card}>
            <h2 className="font-display text-lg">Make your first game</h2>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
              <li>Pick a preset (or describe one) — try the Platformer.</li>
              <li>Add objects: a player, some coins, an enemy, a goal.</li>
              <li>Use Vibe edit: “add a health bar”, “make it easier”.</li>
              <li>Download the Godot project (ZIP).</li>
              <li>Install Godot 4 (free), open the folder, press Play.</li>
              <li>Swap the colored rectangles for your own art in <code>assets/</code>.</li>
            </ol>
          </div>
          <div className={card}>
            <h2 className="font-display text-lg">Licenses & ownership</h2>
            <ul className="mt-1 list-disc pl-5 text-xs">
              <li><strong>Engine:</strong> Godot (MIT) — free, royalty-free.</li>
              <li><strong>Placeholders:</strong> plain colored shapes — nothing copyrighted.</li>
              <li><strong>Your content:</strong> art/audio you add is yours to license.</li>
              <li><strong>Your game:</strong> the exported project is 100% yours.</li>
              <li><strong>Keep it original:</strong> no names, characters, maps, or logos from existing games.</li>
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
