"use client";

// ============================================================
// Software Creation Mode (§31, Phase 1) — the shell
// ============================================================
// "Visual vibe coding": drag a big feature card from the side panel into your
// project, see a Safe Build Preview, confirm, then answer simple questions.
// Beginner mode by default; Advanced reveals preset ids + the safe terminal.
// Native HTML5 drag-and-drop (no library) to protect the bundle budget; jszip
// is dynamic-imported only for backup/restore. Everything local + offline.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES, PRESETS, getPreset, presetsInCategory,
  createProject, addFeature, removeFeature, renameFeature, setFeatureOption,
  rollbackTo, canRollback, serializeProject, parseProjectBackup,
  checkProject, readyToBuild, previewAdd, runCommand, buildProject, type TerminalResult,
  softwareProjectSchema, SOFTWARE_STORE_KEY,
  type SoftwareProject, type Preset, type BuildPreview,
} from "../index.ts";

const card = "rounded-2xl border border-ink/10 bg-white/70 p-4";
const inp = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const BADGE: Record<string, string> = { ok: "bg-emerald-100 text-emerald-800", warn: "bg-amber-100 text-amber-800", error: "bg-red-100 text-red-800" };

function dlBlob(text: string, name: string) {
  const u = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
}

export function SoftwareCreation() {
  const [proj, setProj] = useState<SoftwareProject>(() => createProject());
  const [openCat, setOpenCat] = useState<string>(CATEGORIES[0].id);
  const [preview, setPreview] = useState<{ presetId: string; pv: BuildPreview } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // load + auto-save (offline, local)
  useEffect(() => {
    try { const r = localStorage.getItem(SOFTWARE_STORE_KEY); if (r) setProj(softwareProjectSchema.parse(JSON.parse(r))); } catch { /* */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(SOFTWARE_STORE_KEY, JSON.stringify(proj)); } catch { /* */ } }, [proj, loaded]);

  const health = useMemo(() => checkProject(proj), [proj]);
  const advanced = proj.mode === "advanced";

  const askPreview = (presetId: string) => setPreview({ presetId, pv: previewAdd(proj, presetId) });
  const confirmAdd = () => { if (preview) { setProj(addFeature(proj, preview.presetId)); setPreview(null); } };

  const [building, setBuilding] = useState(false);
  const buildAndExport = async () => {
    setBuilding(true);
    try {
      const out = buildProject(proj);
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const [path, content] of Object.entries(out.files)) zip.file(path, content);
      const blob = await zip.generateAsync({ type: "blob" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = u;
      a.download = `${proj.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "project"}.zip`;
      a.click(); URL.revokeObjectURL(u);
      if (out.warnings.length) alert(`Exported. Notes:\n\n${out.warnings.join("\n")}`);
    } finally { setBuilding(false); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 font-body text-ink">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/tools" className="text-xs text-muted hover:underline">‹ Creation Studio</a>
          <input value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} className="block bg-transparent font-display text-2xl focus:outline-none" aria-label="Project name" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[health.level]}`} title={health.summary}>{health.level === "ok" ? "✓ Ready" : health.level === "warn" ? "● Notes" : "▲ Needs attention"}</span>
          <div className="flex overflow-hidden rounded-full border border-ink/20 text-xs">
            <button type="button" onClick={() => setProj({ ...proj, mode: "beginner" })} className={`px-3 py-1 ${!advanced ? "bg-ink text-cream" : ""}`}>Beginner</button>
            <button type="button" onClick={() => setProj({ ...proj, mode: "advanced" })} className={`px-3 py-1 ${advanced ? "bg-ink text-cream" : ""}`}>Advanced</button>
          </div>
          <button type="button" onClick={() => dlBlob(serializeProject(proj), `${proj.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "project"}.json`)} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Backup</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Restore</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { setProj(parseProjectBackup(await f.text())); } catch (err) { alert((err as Error).message); }
            e.target.value = "";
          }} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Preset panel (drag from here) */}
        <aside className="space-y-2">
          <p className="px-1 text-xs text-muted">Drag a card into your project →<br />(or tap <strong>Add</strong>)</p>
          {CATEGORIES.map((c) => {
            const open = openCat === c.id;
            return (
              <div key={c.id} className="rounded-2xl border border-ink/10 bg-white/50">
                <button type="button" onClick={() => setOpenCat(open ? "" : c.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
                  <span><span className="mr-1.5 text-lg">{c.icon}</span>{c.name}</span><span className="text-muted">{open ? "▾" : "▸"}</span>
                </button>
                {open ? (
                  <div className="space-y-1.5 px-2 pb-2">
                    {presetsInCategory(c.id).map((p) => <PresetCard key={p.id} preset={p} advanced={advanced} onAdd={() => askPreview(p.id)} />)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </aside>

        {/* Project canvas (drop here) */}
        <section
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/preset"); if (id && getPreset(id)) askPreview(id); }}
          className="min-h-[60vh] rounded-2xl border-2 border-dashed border-ink/15 bg-cream/30 p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg">Your project</h2>
            <span className="flex gap-2">
              {canRollback(proj) ? <button type="button" onClick={() => setProj(rollbackTo(proj))} className="rounded-full border border-ink/20 px-3 py-1 text-xs">↶ Undo</button> : null}
              <button type="button" onClick={() => void buildAndExport()} disabled={!readyToBuild(proj) || building} className="rounded-full bg-ink px-4 py-1 text-xs font-medium text-cream disabled:opacity-40">{building ? "Building…" : "⬇ Build & Export (ZIP)"}</button>
            </span>
          </div>
          <p className="mb-3 text-xs text-muted">{health.summary}</p>

          {proj.features.length === 0 ? (
            <div className="flex min-h-[30vh] items-center justify-center text-center text-sm text-muted">
              Drag a feature card here to start.<br />Pick what you want → drop it in → answer a few questions → build → export.
            </div>
          ) : (
            <ul className="space-y-3">
              {proj.features.map((f) => {
                const preset = getPreset(f.presetId);
                const fh = health.features.find((x) => x.instanceId === f.instanceId)!;
                return (
                  <li key={f.instanceId} className={card}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{preset?.icon ?? "🧩"}</span>
                        <input value={f.label} onChange={(e) => setProj(renameFeature(proj, f.instanceId, e.target.value))} className="bg-transparent font-display text-base focus:outline-none" aria-label="Feature name" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[fh.level]}`}>{fh.level}</span>
                        <button type="button" onClick={() => setProj(removeFeature(proj, f.instanceId))} className="text-xs text-red-700">Remove</button>
                      </div>
                    </div>
                    {preset?.blurb ? <p className="mt-1 text-xs text-muted">{preset.blurb}</p> : null}

                    {/* simple questions */}
                    {preset?.questions.length ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {preset.questions.map((q) => (
                          <label key={q.key} className={`text-xs ${q.type === "longtext" ? "sm:col-span-2" : ""}`}>
                            <span className="mb-0.5 block text-muted">{q.label}{q.required ? " *" : ""}</span>
                            {q.type === "choice" ? (
                              <select className={inp} value={String(f.options[q.key] ?? "")} onChange={(e) => setProj(setFeatureOption(proj, f.instanceId, q.key, e.target.value))}>
                                <option value="">Choose…</option>{q.choices.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : q.type === "bool" ? (
                              <input type="checkbox" className="h-4 w-4 accent-ink" checked={Boolean(f.options[q.key])} onChange={(e) => setProj(setFeatureOption(proj, f.instanceId, q.key, e.target.checked))} />
                            ) : q.type === "longtext" ? (
                              <textarea rows={3} className={inp} value={String(f.options[q.key] ?? "")} onChange={(e) => setProj(setFeatureOption(proj, f.instanceId, q.key, e.target.value))} placeholder={q.help} />
                            ) : (
                              <input type={q.type === "number" ? "number" : "text"} className={inp} value={String(f.options[q.key] ?? "")} onChange={(e) => setProj(setFeatureOption(proj, f.instanceId, q.key, e.target.value))} />
                            )}
                          </label>
                        ))}
                      </div>
                    ) : null}

                    {/* health items */}
                    <ul className="mt-2 space-y-0.5 text-[11px]">
                      {fh.items.map((it, i) => <li key={i} className={it.level === "error" ? "text-red-700" : it.level === "warn" ? "text-amber-700" : "text-emerald-700"}>• {it.message}</li>)}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {advanced ? <AdvancedTerminal proj={proj} setProj={setProj} /> : null}

      <p className="mt-4 text-[11px] text-muted">Everything here is local and offline. Presets marked “preview”/“planned” scaffold your project now; full build &amp; export for each land in later updates. Never stores payment card data.</p>

      {/* Safe Build Preview modal */}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className={`${card} max-h-[80vh] w-full max-w-md overflow-auto bg-white`} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg">Safe Build Preview</h3>
            <p className="text-xs text-muted">This is a preview — nothing changes until you press Add.</p>
            <ul className="mt-3 space-y-0.5 text-sm">{preview.pv.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            {preview.pv.warnings.length ? <ul className="mt-2 space-y-0.5 text-xs text-amber-700">{preview.pv.warnings.map((w, i) => <li key={i}>! {w}</li>)}</ul> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Cancel</button>
              <button type="button" onClick={confirmAdd} className="rounded-full bg-ink px-5 py-1.5 text-sm font-medium text-cream">Add to project</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PresetCard({ preset, advanced, onAdd }: { preset: Preset; advanced: boolean; onAdd: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/preset", preset.id); e.dataTransfer.effectAllowed = "copy"; }}
      className="flex cursor-grab items-center gap-2 rounded-xl border border-ink/10 bg-white px-2.5 py-2 active:cursor-grabbing"
      title={preset.blurb}
    >
      <span className="text-xl">{preset.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{preset.name}</span>
        {advanced ? <span className="block truncate text-[10px] text-muted">{preset.id} · {preset.status}</span> : null}
      </span>
      <button type="button" onClick={onAdd} className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-cream">Add</button>
    </div>
  );
}

function AdvancedTerminal({ proj, setProj }: { proj: SoftwareProject; setProj: (p: SoftwareProject) => void }) {
  const [lines, setLines] = useState<string[]>(["Software Creation console — type \"help\". Local & offline."]);
  const [cmd, setCmd] = useState("");
  const run = () => {
    if (!cmd.trim()) return;
    const res: TerminalResult = runCommand(proj, cmd);
    if (res.output === "\f") { setLines([]); setCmd(""); return; }
    setLines((l) => [...l, `$ ${cmd}`, res.output]);
    if (res.project) setProj(res.project);
    setCmd("");
  };
  return (
    <section className="mt-4 rounded-2xl border border-ink/15 bg-ink/95 p-3 font-mono text-xs text-emerald-100">
      <div className="mb-1 flex items-center justify-between text-emerald-300/70"><span>▸ Advanced console (safe — local only)</span></div>
      <div className="max-h-56 overflow-auto whitespace-pre-wrap">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
      <div className="mt-2 flex items-center gap-1">
        <span className="text-emerald-300">$</span>
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} className="flex-1 bg-transparent outline-none" aria-label="Console command" placeholder="help" autoComplete="off" spellCheck={false} />
      </div>
    </section>
  );
}
