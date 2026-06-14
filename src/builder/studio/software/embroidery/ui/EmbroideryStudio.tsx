"use client";

// ============================================================
// Embroidery Studio (§31, Phase 5) — interactive counted design editor
// ============================================================
// Paint a counted cross-stitch design, stamp names/monograms with the built-in
// 5x7 font, see live size/thread/hoop/density numbers, and export a printable
// chart, a PNG, a JSON you can reopen, and an EXPERIMENTAL Tajima DST machine
// file. 100% offline, local, no libraries. Honest about preview vs machine.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  THREADS, thread, createGrid, setCell, getCell, stampText, clearGrid, textWidth,
  buildStitchPlan, toDst, toExp, toJef, metrics, checkDesign, HOOPS, gridFromPixels,
  resampleGrid, splitForHoop, jobCost, hoopCells,
  EMBROIDERY_STORE_KEY, EMBROIDERY_BACKUP_TAG,
  type Grid, type StitchStyle,
} from "../index.ts";

const LIBRARY_KEY = "lusik_embroidery_library";

const CELL = 15;
const card = "rounded-2xl border border-ink/10 bg-white/70 p-3";
const inp = "rounded-xl border border-ink/20 bg-white px-2 py-1 text-sm focus:border-accent focus:outline-none";

interface SavedShape { grid: Grid; count: number; mmPerCell: number; hoopIdx: number; title: string; style?: StitchStyle; }

export function EmbroideryStudio() {
  const [grid, setGrid] = useState<Grid>(() => createGrid(40, 30));
  const [title, setTitle] = useState("My design");
  const [color, setColor] = useState(2); // black
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [count, setCount] = useState(14);
  const [mmPerCell, setMm] = useState(2);
  const [hoopIdx, setHoopIdx] = useState(0);
  const [style, setStyle] = useState<StitchStyle>("cross");
  const [maxColors, setMaxColors] = useState(0); // 0 = no cap
  const [dither, setDither] = useState(false);
  const [underlay, setUnderlay] = useState(false);
  const [pullComp, setPullComp] = useState(0);
  const [text, setText] = useState("");
  const [libName, setLibName] = useState("");
  const [library, setLibrary] = useState<Array<{ name: string; shape: SavedShape }>>([]);
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // load + autosave
  useEffect(() => {
    try {
      const r = localStorage.getItem(EMBROIDERY_STORE_KEY);
      if (r) { const s = JSON.parse(r) as SavedShape; if (s.grid?.cells) { setGrid(s.grid); setTitle(s.title ?? "My design"); setCount(s.count ?? 14); setMm(s.mmPerCell ?? 2); setHoopIdx(s.hoopIdx ?? 0); setStyle(s.style ?? "cross"); } }
      const lib = localStorage.getItem(LIBRARY_KEY); if (lib) setLibrary(JSON.parse(lib));
    } catch { /* */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(EMBROIDERY_STORE_KEY, JSON.stringify({ grid, count, mmPerCell, hoopIdx, title, style } satisfies SavedShape)); } catch { /* */ } }, [grid, count, mmPerCell, hoopIdx, title, style, loaded]);

  const m = useMemo(() => metrics(grid, count, mmPerCell, style), [grid, count, mmPerCell, style]);
  const checks = useMemo(() => checkDesign(grid, HOOPS[hoopIdx], count, mmPerCell, style), [grid, hoopIdx, count, mmPerCell, style]);

  // draw the canvas whenever the design changes
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = grid.w * CELL; cv.height = grid.h * CELL;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      const c = getCell(grid, x, y);
      if (c >= 0) { ctx.fillStyle = thread(c).hex; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    }
    // grid lines, bold every 10
    for (let x = 0; x <= grid.w; x++) { ctx.strokeStyle = x % 10 === 0 ? "#1a1612" : "#d9cfb6"; ctx.lineWidth = x % 10 === 0 ? 1.4 : 0.5; ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, cv.height); ctx.stroke(); }
    for (let y = 0; y <= grid.h; y++) { ctx.strokeStyle = y % 10 === 0 ? "#1a1612" : "#d9cfb6"; ctx.lineWidth = y % 10 === 0 ? 1.4 : 0.5; ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(cv.width, y * CELL); ctx.stroke(); }
  }, [grid]);

  const cellAt = (e: React.PointerEvent) => {
    const cv = canvasRef.current!; const r = cv.getBoundingClientRect();
    return { x: Math.floor(((e.clientX - r.left) / r.width) * grid.w), y: Math.floor(((e.clientY - r.top) / r.height) * grid.h) };
  };
  const paint = (e: React.PointerEvent) => { const { x, y } = cellAt(e); setGrid((g) => setCell(g, x, y, tool === "erase" ? -1 : color)); };

  const resize = (w: number, h: number) => setGrid((g) => {
    const ng = createGrid(w, h);
    const cells = ng.cells.slice();
    for (let y = 0; y < Math.min(h, g.h); y++) for (let x = 0; x < Math.min(w, g.w); x++) cells[y * ng.w + x] = g.cells[y * g.w + x];
    return { ...ng, cells };
  });

  const stamp = () => { if (!text.trim()) return; const tw = textWidth(text); const ox = Math.max(0, Math.floor((grid.w - tw) / 2)); const oy = Math.max(0, Math.floor((grid.h - 7) / 2)); setGrid((g) => stampText(g, text, ox, oy, color)); };

  const imgRef = useRef<HTMLInputElement>(null);
  // Auto-digitize: draw the image at the grid size, read pixels, map to threads.
  const importImage = (f: File) => {
    const img = new Image();
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = grid.w; off.height = grid.h;
      const ctx = off.getContext("2d"); if (!ctx) return;
      // contain the image in the grid
      const scale = Math.min(grid.w / img.width, grid.h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (grid.w - dw) / 2, (grid.h - dh) / 2, dw, dh);
      const data = ctx.getImageData(0, 0, grid.w, grid.h).data;
      setGrid((g) => ({ ...gridFromPixels(data, g.w, g.h, { dither, maxColors }), w: g.w, h: g.h }));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };

  // Stamp text in any installed font (covers Armenian and every script) by
  // rasterizing it to the grid — offline, using the OS's own fonts.
  const stampFont = () => {
    if (!text.trim()) return;
    const off = document.createElement("canvas");
    off.width = grid.w; off.height = grid.h;
    const ctx = off.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, grid.w, grid.h);
    // grow the font until the text fills ~80% of the grid width
    let px = grid.h;
    ctx.fillStyle = "#000";
    for (; px > 4; px--) { ctx.font = `bold ${px}px serif`; if (ctx.measureText(text).width <= grid.w * 0.9) break; }
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText(text, grid.w / 2, grid.h / 2);
    const data = ctx.getImageData(0, 0, grid.w, grid.h).data;
    // map non-white pixels to the chosen thread color (single-color text)
    setGrid((g) => {
      const cells = g.cells.slice();
      for (let i = 0; i < g.w * g.h; i++) { const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2]; if (r < 200 || gg < 200 || b < 200) cells[i] = color; }
      return { ...g, cells };
    });
  };

  // exports
  const planOpts = { underlay, pullCompMm: pullComp };
  const dl = (blob: Blob, name: string) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const slug = (title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "design");
  const bin = (bytes: Uint8Array) => new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const exportPng = () => canvasRef.current?.toBlob((b) => { if (b) dl(b, `${slug}.png`); });
  const exportDst = () => dl(bin(toDst(buildStitchPlan(grid, mmPerCell, style, planOpts), title)), `${slug}.dst`);
  const exportExp = () => dl(bin(toExp(buildStitchPlan(grid, mmPerCell, style, planOpts))), `${slug}.exp`);
  const exportJef = () => dl(bin(toJef(buildStitchPlan(grid, mmPerCell, style, planOpts))), `${slug}.jef`);
  const exportJson = () => dl(new Blob([JSON.stringify({ tag: EMBROIDERY_BACKUP_TAG, grid, count, mmPerCell, hoopIdx, title, style }, null, 2)], { type: "application/json" }), `${slug}.json`);
  const importJson = async (f: File) => { try { const o = JSON.parse(await f.text()); if (o.tag !== EMBROIDERY_BACKUP_TAG || !o.grid?.cells) throw new Error("Not an embroidery design file."); setGrid(o.grid); setTitle(o.title ?? "My design"); setCount(o.count ?? 14); setMm(o.mmPerCell ?? 2); setHoopIdx(o.hoopIdx ?? 0); setStyle(o.style ?? "cross"); } catch (e) { alert((e as Error).message); } };

  // resize-and-recalculate the design to fit the current grid box
  const resample = () => { const w = prompt("New width in stitches?", String(grid.w)); const h = prompt("New height in stitches?", String(grid.h)); if (w && h) setGrid((g) => resampleGrid(g, Number(w) || g.w, Number(h) || g.h)); };

  // multi-hoop split → a ZIP of one DST per tile
  const exportSplit = async () => {
    const hc = hoopCells(HOOPS[hoopIdx], mmPerCell);
    const tiles = splitForHoop(grid, hc.w, hc.h);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    tiles.forEach((t) => zip.file(`${slug}-r${t.row}-c${t.col}.dst`, toDst(buildStitchPlan(t.grid, mmPerCell, style, planOpts), `${slug}-${t.row}-${t.col}`)));
    dl(await zip.generateAsync({ type: "blob" }), `${slug}-hoops.zip`);
  };

  // printable production worksheet (cost + thread list + stats)
  const worksheet = () => {
    const cost = jobCost({ stitches: m.stitches, colors: m.colors });
    const palette = [...new Set(grid.cells.filter((c) => c >= 0))].sort((a, b) => a - b);
    const rows = palette.map((i) => `<tr><td style="background:${thread(i).hex};width:18px"></td><td>${thread(i).ref}</td><td>${thread(i).name}</td></tr>`).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><meta charset=utf-8><title>${slug} worksheet</title><style>body{font-family:system-ui;margin:24px;color:#1a1612}table{border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}</style>` +
      `<h1>${title}</h1><p>Stitches: <b>${m.stitches}</b> · Colors: <b>${m.colors}</b> · Finished: <b>${m.finishedInW}×${m.finishedInH}in</b> (${m.finishedMmW}×${m.finishedMmH}mm)</p>` +
      `<p>Est. sew time: <b>${cost.minutesEach} min</b> · Suggested price each: <b>$${cost.priceEach}</b> (edit rates in your own pricing)</p>` +
      `<h2>Thread list</h2><table><tr><th></th><th>Ref</th><th>Color</th></tr>${rows}</table>` +
      `<p style="margin-top:16px;color:#777;font-size:12px">Machine files are experimental — test on your machine before a final piece.</p>`);
    w.document.close(); w.print();
  };

  // local design library (save/load named designs on this device)
  const currentShape = (): SavedShape => ({ grid, count, mmPerCell, hoopIdx, title, style });
  const loadShape = (s: SavedShape) => { setGrid(s.grid); setTitle(s.title); setCount(s.count); setMm(s.mmPerCell); setHoopIdx(s.hoopIdx); setStyle(s.style ?? "cross"); };
  const saveLibrary = (next: typeof library) => { setLibrary(next); try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); } catch { /* */ } };
  const addToLibrary = () => { const name = (libName || title).trim(); if (!name) return; const next = [...library.filter((e) => e.name !== name), { name, shape: currentShape() }]; saveLibrary(next); setLibName(""); };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 font-body text-ink">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <a href="/tools" className="text-xs text-muted hover:underline">‹ Creation Studio</a>
          <h1 className="font-display text-2xl">🪡 Embroidery Studio</h1>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inp} font-display`} aria-label="Design title" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* canvas */}
        <section className={card}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex overflow-hidden rounded-full border border-ink/20 text-xs">
              <button type="button" onClick={() => setTool("paint")} className={`px-3 py-1 ${tool === "paint" ? "bg-ink text-cream" : ""}`}>✏️ Paint</button>
              <button type="button" onClick={() => setTool("erase")} className={`px-3 py-1 ${tool === "erase" ? "bg-ink text-cream" : ""}`}>🧽 Erase</button>
            </div>
            <button type="button" onClick={() => { if (confirm("Clear the whole design?")) setGrid((g) => clearGrid(g)); }} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Clear</button>
            <span className="ml-auto text-xs text-muted">Grid {grid.w}×{grid.h}</span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-ink/10 bg-cream/40 p-2">
            <canvas
              ref={canvasRef}
              className="touch-none"
              style={{ width: grid.w * CELL, height: grid.h * CELL, imageRendering: "pixelated", cursor: "crosshair" }}
              onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); paint(e); }}
              onPointerMove={(e) => { if (drawing.current) paint(e); }}
              onPointerUp={() => { drawing.current = false; }}
              onPointerLeave={() => { drawing.current = false; }}
            />
          </div>
          {/* text-to-stitch */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a name…" className={inp} aria-label="Text to stitch" maxLength={20} />
            <button type="button" onClick={stamp} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Stamp (pixel font)</button>
            <button type="button" onClick={stampFont} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm" title="Uses your computer's fonts — works for Armenian and any script">Stamp (any font)</button>
            <span className="text-xs text-muted">“Any font” uses your computer's fonts — Armenian, monograms, any script.</span>
          </div>
          {/* auto-digitize image with photo options */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => imgRef.current?.click()} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">🖼 Auto-digitize image</button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ""; }} />
            <label className="flex items-center gap-1"><input type="checkbox" className="h-3.5 w-3.5 accent-ink" checked={dither} onChange={(e) => setDither(e.target.checked)} />dither (photos)</label>
            <label className="flex items-center gap-1">max colors <select value={maxColors} onChange={(e) => setMaxColors(Number(e.target.value))} className={inp}>{[0, 4, 6, 8, 12, 16].map((n) => <option key={n} value={n}>{n === 0 ? "no limit" : n}</option>)}</select></label>
          </div>
        </section>

        {/* controls */}
        <aside className="space-y-3">
          <div className={card}>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Thread</h2>
            <div className="grid grid-cols-9 gap-1">
              {THREADS.map((t, i) => (
                <button key={t.ref} type="button" title={`${t.ref} — ${t.name}`} onClick={() => { setColor(i); setTool("paint"); }} className={`h-6 w-6 rounded ${color === i ? "ring-2 ring-ink ring-offset-1" : ""}`} style={{ background: t.hex, border: "1px solid #0002" }} />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{thread(color).ref} — {thread(color).name}</p>
          </div>

          <div className={card}>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Size & hoop</h2>
            <label className="flex items-center justify-between gap-2 text-sm">Width <input type="number" min={5} max={200} value={grid.w} onChange={(e) => resize(Number(e.target.value) || grid.w, grid.h)} className={`${inp} w-20`} /></label>
            <label className="mt-1 flex items-center justify-between gap-2 text-sm">Height <input type="number" min={5} max={200} value={grid.h} onChange={(e) => resize(grid.w, Number(e.target.value) || grid.h)} className={`${inp} w-20`} /></label>
            <label className="mt-1 flex items-center justify-between gap-2 text-sm">Aida count <input type="number" min={6} max={28} value={count} onChange={(e) => setCount(Number(e.target.value) || 14)} className={`${inp} w-20`} /></label>
            <label className="mt-1 flex items-center justify-between gap-2 text-sm">Stitch mm <input type="number" min={1} max={6} step={0.5} value={mmPerCell} onChange={(e) => setMm(Number(e.target.value) || 2)} className={`${inp} w-20`} /></label>
            <label className="mt-1 block text-sm">Hoop<select value={hoopIdx} onChange={(e) => setHoopIdx(Number(e.target.value))} className={`${inp} mt-1 w-full`}>{HOOPS.map((h, i) => <option key={h.name} value={i}>{h.name}</option>)}</select></label>
            <label className="mt-1 block text-sm">Stitch style<select value={style} onChange={(e) => setStyle(e.target.value as StitchStyle)} className={`${inp} mt-1 w-full`}><option value="cross">Cross-stitch (X per cell)</option><option value="tatami">Tatami (single tack)</option><option value="running">Running (outline / line)</option></select></label>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" className="h-3.5 w-3.5 accent-ink" checked={underlay} onChange={(e) => setUnderlay(e.target.checked)} />underlay</label>
              <label className="flex items-center gap-1">pull comp (mm) <input type="number" min={0} max={3} step={0.5} value={pullComp} onChange={(e) => setPullComp(Number(e.target.value) || 0)} className={`${inp} w-16`} /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={resample} className="rounded-full border border-ink/20 px-3 py-1 text-xs">↔ Resize design</button>
              <button type="button" onClick={() => void exportSplit()} className="rounded-full border border-ink/20 px-3 py-1 text-xs" title="Split a big design into hoop-sized DST tiles">✂ Split into hoops</button>
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">This design</h2>
            <ul className="text-xs">
              <li>Stitches: <strong>{m.stitches}</strong></li>
              <li>Colors: <strong>{m.colors}</strong></li>
              <li>Finished: <strong>{m.finishedInW}″ × {m.finishedInH}″</strong> ({m.finishedMmW}×{m.finishedMmH}mm)</li>
              <li>Thread: <strong>~{m.threadMeters} m</strong> · Fill {m.fillPct}%</li>
            </ul>
            <ul className="mt-2 space-y-1 text-[11px]">
              {checks.map((c, i) => <li key={i} className={c.level === "warn" ? "text-amber-700" : c.level === "info" ? "text-muted" : "text-emerald-700"}>• {c.message}</li>)}
            </ul>
          </div>

          <div className={`${card} flex flex-wrap gap-2`}>
            <button type="button" onClick={() => window.print()} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm">🖨 Chart</button>
            <button type="button" onClick={worksheet} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm" title="Production worksheet: cost, sew time, thread list">📋 Worksheet</button>
            <button type="button" onClick={exportPng} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm">🖼 PNG</button>
            <button type="button" onClick={exportDst} className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-cream" title="Experimental Tajima DST">🧵 DST</button>
            <button type="button" onClick={exportExp} className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-cream" title="Experimental Melco/Bernina EXP">🧵 EXP</button>
            <button type="button" onClick={exportJef} className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-cream" title="Experimental Janome JEF">🧵 JEF</button>
            <button type="button" onClick={exportJson} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm">Save</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border border-ink/20 px-3 py-1.5 text-sm">Open</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ""; }} />
          </div>

          {/* design library (saved on this device) */}
          <div className={card}>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Design library</h2>
            <div className="flex gap-2">
              <input value={libName} onChange={(e) => setLibName(e.target.value)} placeholder="Save current as…" className={`${inp} flex-1`} />
              <button type="button" onClick={addToLibrary} className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream">Save</button>
            </div>
            {library.length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {library.map((e) => (
                  <li key={e.name} className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => loadShape(e.shape)} className="truncate text-left hover:underline">{e.name}</button>
                    <button type="button" onClick={() => saveLibrary(library.filter((x) => x.name !== e.name))} className="text-red-700">✕</button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-[11px] text-muted">No saved designs yet.</p>}
          </div>
        </aside>
      </div>

      <p className="mt-4 text-[11px] text-muted">Everything is local &amp; offline. The chart and size are accurate; the <strong>machine files (DST · EXP · JEF) are experimental</strong> — test on your machine with stabilizer before a final piece. Styles: cross (X per cell), tatami (single tack), running (outline). Optional underlay + pull compensation. PES (Brother) needs a real-machine check and true vector satin/fill digitizing are future work.</p>
    </main>
  );
}
