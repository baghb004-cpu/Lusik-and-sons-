"use client";

// ============================================================
// Offline Media Studio — Phase 1 UI (§26)
// ============================================================
// The beginner workspace: a library of your local media, a LIVE
// preview (photo/video/audio) streamed straight off the drive, a
// visual timeline with draggable grab-handles + a playhead and a
// Split-at-playhead helper, Save-as-New-Clip via the FFmpeg
// sidecar (originals preserved), the export-preset reference, and
// the offline help drawer. Admin-token gated like the rest of the
// Workshop; runs in local (fs) mode. Nothing is ever uploaded.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clipDuration, trimStart, trimEnd, splitAtPlayhead } from "../engine.ts";
import { EXPORT_PRESETS } from "../formats.ts";
import { HELP } from "../help.ts";

// The launcher hands the session token via #token=… (same scheme as
// /builder); we store it under the shared key and strip it from the URL.
const LOCAL_TOKEN_KEY = "lusik_builder_local_token";

interface LibFile { path: string; bytes: number; support: string; kind: string }
type Segment = { inSec: number; outSec: number };

const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const fmtTime = (s: number) => {
  const safe = Number.isFinite(s) && s >= 0 ? s : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
};
const pct = (sec: number, dur: number) => `${Math.max(0, Math.min(100, dur > 0 ? (sec / dur) * 100 : 0))}%`;

export function MediaStudio() {
  const [files, setFiles] = useState<LibFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibFile | null>(null);
  const [durationSec, setDurationSec] = useState(60); // until probed / loaded
  const [inSec, setInSec] = useState(0);
  const [outSec, setOutSec] = useState(10);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [status, setStatus] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const token = useCallback(() => (typeof sessionStorage !== "undefined" && sessionStorage.getItem(LOCAL_TOKEN_KEY)) || "", []);

  const api = useCallback(async (init?: RequestInit) => {
    return fetch("/api/builder/media-studio", { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token()}` } });
  }, [token]);

  // Direct URL the browser's <img>/<video>/<audio> can load. Media elements
  // can't set headers, so the token rides as a query param (loopback only;
  // still required + verified server-side).
  const mediaUrl = useCallback(
    (path: string) => `/api/builder/media-studio?file=${encodeURIComponent(path)}&token=${encodeURIComponent(token())}`,
    [token]
  );

  useEffect(() => {
    const m = /^#token=(.+)$/.exec(window.location.hash);
    if (m && m[1].length >= 16) {
      sessionStorage.setItem(LOCAL_TOKEN_KEY, m[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setTokenReady(true);
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
  useEffect(() => { if (tokenReady) void load(); }, [tokenReady, load]);

  const pick = async (f: LibFile) => {
    setSelected(f);
    setStatus("Reading file details…");
    setInSec(0);
    setOutSec(10);
    setPlayheadSec(0);
    setSegments(null);
    setDurationSec(f.kind === "photo" ? 0 : 60);
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
        setStatus(f.kind === "photo" ? "Photo loaded." : "Loaded. (Install FFmpeg to read exact details and trim.)");
      }
    } catch {
      setStatus("Loaded.");
    }
  };

  const trimViaApi = useCallback(async (seg: Segment, label: string) => {
    if (!selected) return;
    setStatus(`Saving ${label}…`);
    const res = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trim", path: selected.path, inSec: seg.inSec, outSec: seg.outSec }) });
    const body = await res.json();
    if (res.ok) {
      setStatus(`✅ Saved a NEW clip → ${body.path} (your original "${body.preserved}" is untouched).`);
      void load();
    } else if (res.status === 409) {
      setStatus(`${body.error} ${body.hint}`);
    } else {
      setStatus(body.error || "Could not save the clip.");
    }
  }, [api, selected, load]);

  const saveClip = () => void trimViaApi({ inSec, outSec }, "the trimmed clip");

  // grab-handle math via the pure engine (clamped, never inverts)
  const clip = useMemo(() => ({ id: "c", sourceId: "s", inSec, outSec, trackOffsetSec: 0 }), [inSec, outSec]);
  const isTimeline = selected ? selected.kind !== "photo" : false;

  // Map a clientX on the track to a time in seconds.
  const secFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el || durationSec <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * durationSec;
  }, [durationSec]);

  // Drag a handle (start | end) with pointer capture.
  const dragHandle = (which: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const sec = secFromClientX(ev.clientX);
      if (which === "start") setInSec(trimStart(clip, sec).inSec);
      else setOutSec(trimEnd(clip, sec, durationSec).outSec);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Click the track body to move the playhead (and seek the preview).
  const seekTo = (clientX: number) => {
    const sec = secFromClientX(clientX);
    setPlayheadSec(sec);
    if (mediaRef.current) mediaRef.current.currentTime = sec;
  };

  const doSplit = () => {
    const parts = splitAtPlayhead({ ...clip, trackOffsetSec: 0 }, playheadSec, () => "r");
    if (parts.length === 2) {
      setSegments([
        { inSec: parts[0].inSec, outSec: parts[0].outSec },
        { inSec: parts[1].inSec, outSec: parts[1].outSec },
      ]);
      setStatus(`Split at ${fmtTime(playheadSec)} — save either half as its own new clip.`);
    } else {
      setStatus("Move the playhead inside the selected range first, then split.");
    }
  };

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

      {/* editor: preview + timeline */}
      {selected ? (
        <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
          <h2 className="font-display text-lg">Editing: {selected.path.split("/").pop()}</h2>
          <p className="mt-0.5 text-xs text-muted" data-testid="media-status">{status}</p>

          {/* live preview */}
          <div className="mt-3 overflow-hidden rounded-xl bg-ink/5">
            {selected.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(selected.path)} alt={selected.path.split("/").pop()} className="mx-auto max-h-[60vh] w-auto" data-testid="media-preview" />
            ) : selected.kind === "video" ? (
              <video
                ref={(el) => { mediaRef.current = el; }}
                src={mediaUrl(selected.path)}
                controls
                playsInline
                className="mx-auto max-h-[60vh] w-full bg-black"
                data-testid="media-preview"
                onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) { setDurationSec(d); setOutSec((o) => Math.min(o || d, d)); } }}
                onTimeUpdate={(e) => setPlayheadSec(e.currentTarget.currentTime)}
              />
            ) : selected.kind === "audio" ? (
              <audio
                ref={(el) => { mediaRef.current = el; }}
                src={mediaUrl(selected.path)}
                controls
                className="w-full"
                data-testid="media-preview"
                onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) { setDurationSec(d); setOutSec((o) => Math.min(o || d, d)); } }}
                onTimeUpdate={(e) => setPlayheadSec(e.currentTarget.currentTime)}
              />
            ) : (
              <p className="p-4 text-sm text-muted">Preview isn't available for this file type, but you can still trim it.</p>
            )}
          </div>

          {/* visual timeline (video/audio) */}
          {isTimeline ? (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Drag the handles to trim · click the bar to move the playhead</span>
                <span className="tabular-nums">{fmtTime(playheadSec)} / {fmtTime(durationSec)}</span>
              </div>
              <div
                ref={trackRef}
                className="relative h-12 w-full select-none rounded-lg bg-ink/10"
                onPointerDown={(e) => { if (e.target === e.currentTarget) seekTo(e.clientX); }}
                role="presentation"
              >
                {/* selected region */}
                <div
                  className="absolute inset-y-0 rounded-md bg-accent/30"
                  style={{ left: pct(inSec, durationSec), right: `calc(100% - ${pct(outSec, durationSec)})` }}
                  data-testid="timeline-selection"
                />
                {/* start handle */}
                <div
                  onPointerDown={dragHandle("start")}
                  className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-ink"
                  style={{ left: pct(inSec, durationSec) }}
                  role="slider"
                  aria-label="Trim start"
                  aria-valuemin={0}
                  aria-valuemax={durationSec}
                  aria-valuenow={inSec}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "ArrowLeft") setInSec(trimStart(clip, inSec - 1).inSec); if (e.key === "ArrowRight") setInSec(trimStart(clip, inSec + 1).inSec); }}
                />
                {/* end handle */}
                <div
                  onPointerDown={dragHandle("end")}
                  className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-ink"
                  style={{ left: pct(outSec, durationSec) }}
                  role="slider"
                  aria-label="Trim end"
                  aria-valuemin={0}
                  aria-valuemax={durationSec}
                  aria-valuenow={outSec}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "ArrowLeft") setOutSec(trimEnd(clip, outSec - 1, durationSec).outSec); if (e.key === "ArrowRight") setOutSec(trimEnd(clip, outSec + 1, durationSec).outSec); }}
                />
                {/* playhead */}
                <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-rose-500" style={{ left: pct(playheadSec, durationSec) }} data-testid="timeline-playhead" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span>Selected length: <strong className="tabular-nums">{fmtTime(clipDuration(clip))}</strong></span>
                <button type="button" onClick={() => setInSec(trimStart(clip, playheadSec).inSec)} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Set start to playhead</button>
                <button type="button" onClick={() => setOutSec(trimEnd(clip, playheadSec, durationSec).outSec)} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Set end to playhead</button>
                <button type="button" onClick={doSplit} className="rounded-full border border-ink/20 px-3 py-1 text-xs">✂︎ Split at playhead</button>
              </div>

              {/* split result — save either half */}
              {segments ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="split-segments">
                  {segments.map((seg, i) => (
                    <div key={i} className="rounded-xl border border-ink/15 bg-cream/50 p-3 text-sm">
                      <p className="font-medium">{i === 0 ? "First half" : "Second half"}</p>
                      <p className="text-xs text-muted tabular-nums">{fmtTime(seg.inSec)} → {fmtTime(seg.outSec)} ({fmtTime(seg.outSec - seg.inSec)})</p>
                      <button type="button" onClick={() => void trimViaApi(seg, i === 0 ? "the first half" : "the second half")} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream hover:opacity-90">Save this half</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* accessible slider fallback + trim controls (kept for video/audio) */}
          {isTimeline ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 flex justify-between text-xs text-muted"><span>Start ⟵ grab handle</span><span className="tabular-nums">{fmtTime(inSec)}</span></span>
                <input type="range" min={0} max={durationSec} step={0.1} value={inSec} onChange={(e) => setInSec(trimStart(clip, Number(e.target.value)).inSec)} className="w-full accent-ink" aria-label="Trim start (slider)" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 flex justify-between text-xs text-muted"><span>End grab handle ⟶</span><span className="tabular-nums">{fmtTime(outSec)}</span></span>
                <input type="range" min={0} max={durationSec} step={0.1} value={outSec} onChange={(e) => setOutSec(trimEnd(clip, Number(e.target.value), durationSec).outSec)} className="w-full accent-ink" aria-label="Trim end (slider)" />
              </label>
              <button type="button" onClick={saveClip} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
                ✂️ Save as New Clip
              </button>
            </div>
          ) : null}
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
