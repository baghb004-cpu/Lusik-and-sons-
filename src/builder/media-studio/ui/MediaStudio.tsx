"use client";

// ============================================================
// Offline Media Studio — Phase 1 UI (§26)
// ============================================================
// The beginner workspace: a library of your local media, a trim
// panel with grab-handle sliders that calls the FFmpeg sidecar to
// Save-as-New-Clip (originals preserved), the export-preset
// reference, and the offline help drawer. Admin-token gated like
// the rest of the Workshop; runs in local (fs) mode.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { clipDuration, trimStart, trimEnd } from "../engine.ts";
import { EXPORT_PRESETS } from "../formats.ts";
import { HELP } from "../help.ts";

// The launcher hands the session token via #token=… (same scheme as
// /builder); we store it under the shared key and strip it from the URL.
const LOCAL_TOKEN_KEY = "lusik_builder_local_token";

interface LibFile { path: string; bytes: number; support: string; kind: string }
const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MediaStudio() {
  const [files, setFiles] = useState<LibFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibFile | null>(null);
  const [durationSec, setDurationSec] = useState(60); // until probed
  const [inSec, setInSec] = useState(0);
  const [outSec, setOutSec] = useState(10);
  const [status, setStatus] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const api = useCallback(async (init?: RequestInit) => {
    const token = (typeof sessionStorage !== "undefined" && sessionStorage.getItem(LOCAL_TOKEN_KEY)) || "";
    return fetch("/api/builder/media-studio", { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, []);

  useEffect(() => {
    const m = /^#token=(.+)$/.exec(window.location.hash);
    if (m && m[1].length >= 16) {
      sessionStorage.setItem(LOCAL_TOKEN_KEY, m[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api();
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `list failed (${res.status})`);
      setFiles(((await res.json()) as { files: LibFile[] }).files);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const pick = async (f: LibFile) => {
    setSelected(f);
    setStatus("Reading file details…");
    setInSec(0);
    setOutSec(10);
    try {
      const res = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "probe", path: f.path }) });
      const body = await res.json();
      if (res.ok && body.facts?.durationSec) {
        setDurationSec(body.facts.durationSec);
        setOutSec(Math.min(10, body.facts.durationSec));
        setStatus(`${body.facts.container ?? f.kind} · ${body.facts.codec ?? ""} · ${fmtTime(body.facts.durationSec)}${body.facts.width ? ` · ${body.facts.width}×${body.facts.height}` : ""}`);
      } else if (res.status === 409) {
        setStatus(`${body.error} ${body.hint}`);
      } else {
        setStatus("Loaded. (Install FFmpeg to read exact details and trim.)");
      }
    } catch {
      setStatus("Loaded.");
    }
  };

  const saveClip = async () => {
    if (!selected) return;
    setStatus("Saving the trimmed clip…");
    const res = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trim", path: selected.path, inSec, outSec }) });
    const body = await res.json();
    if (res.ok) {
      setStatus(`✅ Saved a NEW clip → ${body.path} (your original "${body.preserved}" is untouched).`);
      void load();
    } else if (res.status === 409) {
      setStatus(`${body.error} ${body.hint}`);
    } else {
      setStatus(body.error || "Could not save the clip.");
    }
  };

  // grab-handle math via the pure engine (clamped, never inverts)
  const clip = useMemo(() => ({ id: "c", sourceId: "s", inSec, outSec, trackOffsetSec: 0 }), [inSec, outSec]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">🎬 Media Studio</h1>
        <button type="button" onClick={() => setHelpOpen(true)} className="rounded-full border border-ink/20 px-3 py-1 text-sm">? Help</button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Trim photos, video and phone recordings — all on this device, nothing uploaded. Editing always makes a NEW file;
        your originals are never changed.
      </p>

      {/* library */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Your media library</h2>
        {error ? <p className="text-sm text-muted">{error}</p> : null}
        {files && files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-4 text-sm text-muted">
            No media yet. Copy photos, videos, or voice recordings into <code className="font-mono">portable/media/</code> on the
            drive (photos / videos / audio / voice), then refresh.
          </p>
        ) : null}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(files ?? []).map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => void pick(f)}
                className={`w-full rounded-xl border p-2 text-left text-xs transition ${selected?.path === f.path ? "border-ink bg-cream" : "border-ink/15 hover:bg-cream/60"}`}
              >
                <span className="block truncate font-medium">{f.path.split("/").pop()}</span>
                <span className="block text-muted">{f.kind} · {fmtBytes(f.bytes)}{f.support !== "full" ? ` · ${f.support}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* trim panel */}
      {selected ? (
        <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
          <h2 className="font-display text-lg">Trim: {selected.path.split("/").pop()}</h2>
          <p className="mt-0.5 text-xs text-muted">{status}</p>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 flex justify-between text-xs text-muted"><span>Start ⟵ grab handle</span><span className="tabular-nums">{fmtTime(inSec)}</span></span>
              <input type="range" min={0} max={durationSec} step={0.1} value={inSec} onChange={(e) => setInSec(trimStart(clip, Number(e.target.value)).inSec)} className="w-full accent-ink" aria-label="Trim start" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 flex justify-between text-xs text-muted"><span>End grab handle ⟶</span><span className="tabular-nums">{fmtTime(outSec)}</span></span>
              <input type="range" min={0} max={durationSec} step={0.1} value={outSec} onChange={(e) => setOutSec(trimEnd(clip, Number(e.target.value), durationSec).outSec)} className="w-full accent-ink" aria-label="Trim end" />
            </label>
            <p className="text-sm">Selected length: <strong className="tabular-nums">{fmtTime(clipDuration(clip))}</strong></p>
            <button type="button" onClick={() => void saveClip()} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
              ✂️ Save as New Clip
            </button>
          </div>
        </section>
      ) : null}

      {/* export presets reference */}
      <details className="mt-6 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Export presets ({EXPORT_PRESETS.length})</summary>
        <ul className="grid grid-cols-2 gap-1 px-3 pb-3 text-xs sm:grid-cols-3">
          {EXPORT_PRESETS.map((p) => (
            <li key={p.id} className="rounded border border-ink/10 px-2 py-1">
              <span className="block font-medium">{p.label}</span>
              <span className="text-muted">{p.width && p.height ? `${p.width}×${p.height} ` : ""}{p.format.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* offline help */}
      {helpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setHelpOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-cream p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xl">Media help</h2>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close" className="rounded-full border border-ink/20 px-2.5 py-0.5 text-sm">✕</button>
            </div>
            <dl className="space-y-2">
              {HELP.map((h) => (
                <div key={h.id} className="rounded-lg border border-ink/10 bg-white/60 p-2.5">
                  <dt className="text-sm font-medium">{h.q}</dt>
                  <dd className="mt-0.5 text-xs text-muted">{h.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </main>
  );
}
