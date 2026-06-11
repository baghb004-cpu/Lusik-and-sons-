"use client";

// ============================================================
// Theme panel (Phase 5) — colors, fonts, scales, glass presets
// ============================================================
// Edits builder/theme.json. Guardrails are visible, not buried:
// a live WCAG contrast matrix updates as colors change (the
// engine's checkContrast — same math a publish gate can use
// later), and each glass preset renders a live pill preview over
// a deliberately busy backdrop so readability problems show up
// HERE, not on a phone after publish. The themeSchema save gate
// still has the final word on shape.
// ============================================================

import { useMemo } from "react";
import { themeSchema, type GlassPreset, type Theme } from "../schema/index.ts";
import { checkContrast } from "../engine/index.ts";
import { glassPresetToCss } from "../theme/css.ts";

type Obj = Record<string, unknown>;

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function ThemeEditor({ value, onChange }: { value: Obj; onChange: (next: Obj) => void }) {
  const parsed = useMemo(() => themeSchema.safeParse(value), [value]);
  if (!parsed.success) {
    return (
      <p className="rounded-lg bg-accent/10 p-3 text-sm">
        This theme file doesn’t match the schema — switch to JSON to repair it.
        <span className="mt-1 block font-mono text-xs text-muted">{parsed.error.issues[0]?.message}</span>
      </p>
    );
  }
  const theme = parsed.data;

  const set = (path: string[], v: unknown) => {
    const next = structuredClone(value) as Obj;
    let cursor: Obj = next;
    for (const key of path.slice(0, -1)) cursor = cursor[key] as Obj;
    cursor[path[path.length - 1]] = v;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <Section title="Colors" open>
        <div className="space-y-2">
          {Object.entries(theme.tokens.colors).map(([name, hex]) => (
            <div key={name} className="flex items-center gap-2">
              <input
                type="color"
                value={hex.length === 4 ? expandHex(hex) : hex.slice(0, 7)}
                onChange={(e) => set(["tokens", "colors", name], e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-ink/15"
                aria-label={`${name} color`}
              />
              <span className="w-20 text-sm font-medium">{name}</span>
              <input
                type="text"
                value={hex}
                onChange={(e) => set(["tokens", "colors", name], e.target.value)}
                className={`${inputClass} font-mono text-xs`}
              />
            </div>
          ))}
        </div>
        <ContrastMatrix colors={theme.tokens.colors} />
      </Section>

      <Section title="Fonts">
        {(["display", "body", "accent"] as const).map((slot) => {
          const f = theme.tokens.fonts[slot];
          if (!f) return null;
          return (
            <div key={slot} className="mb-2 grid grid-cols-[70px_1fr_1fr] items-center gap-2">
              <span className="text-sm font-medium">{slot}</span>
              <input type="text" value={f.family} onChange={(e) => set(["tokens", "fonts", slot, "family"], e.target.value)} className={inputClass} aria-label={`${slot} font family`} />
              <input type="text" value={f.fallback} onChange={(e) => set(["tokens", "fonts", slot, "fallback"], e.target.value)} className={`${inputClass} text-xs`} aria-label={`${slot} fallback stack`} />
            </div>
          );
        })}
        <p className="text-xs text-muted">Changing a family here only restyles builder pages — the font file itself loads via the site layout (a developer step).</p>
      </Section>

      <TokenSection title="Type scale" group="typeScale" record={theme.tokens.typeScale} set={set} mono />
      <TokenSection title="Spacing" group="spacing" record={theme.tokens.spacing} set={set} mono />
      <TokenSection title="Corner radius" group="radii" record={theme.tokens.radii} set={set} mono />
      <TokenSection title="Shadows" group="shadows" record={theme.tokens.shadows} set={set} mono />

      <Section title="Glass presets (pill menu & overlays)" open>
        <div className="space-y-4">
          {theme.tokens.glass.map((preset, i) => (
            <GlassPresetEditor
              key={preset.name}
              preset={preset}
              onChange={(next) => set(["tokens", "glass", String(i)], next)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── sections ────────────────────────────────────────────────
function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-ink/10 bg-white/50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function TokenSection({
  title,
  group,
  record,
  set,
  mono,
}: {
  title: string;
  group: string;
  record: Record<string, string>;
  set: (path: string[], v: unknown) => void;
  mono?: boolean;
}) {
  return (
    <Section title={title}>
      <div className="space-y-2">
        {Object.entries(record).map(([name, v]) => (
          <div key={name} className="grid grid-cols-[80px_1fr] items-center gap-2">
            <span className="text-sm">{name}</span>
            <input
              type="text"
              value={v}
              onChange={(e) => set(["tokens", group, name], e.target.value)}
              className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
              aria-label={`${group} ${name}`}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── contrast guardrail ──────────────────────────────────────
const PAIRS: Array<[string, string, string]> = [
  ["ink", "cream", "Body text on page background"],
  ["muted", "cream", "Secondary text"],
  ["accent", "cream", "Accent text / links"],
  ["cream", "ink", "Buttons (cream on ink)"],
];

function ContrastMatrix({ colors }: { colors: Record<string, string> }) {
  return (
    <div className="mt-3 rounded-lg border border-ink/10 p-2">
      <h4 className="mb-1 text-xs uppercase tracking-wide text-muted">Readability (WCAG)</h4>
      <ul className="space-y-1 text-xs">
        {PAIRS.filter(([fg, bg]) => colors[fg] && colors[bg]).map(([fg, bg, label]) => {
          let result;
          try {
            result = checkContrast(colors[fg], colors[bg]);
          } catch {
            return null; // mid-edit invalid hex — the matrix just waits
          }
          return (
            <li key={`${fg}-${bg}`} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-7 rounded border border-ink/10 text-center text-[10px] leading-4" style={{ color: colors[fg], background: colors[bg] }}>
                  Aa
                </span>
                {label}
              </span>
              <span className={result.passesAA ? "text-muted" : "font-medium text-red-700"}>
                {result.ratio.toFixed(1)}:1 {result.passesAA ? (result.passesAAA ? "AAA ✓" : "AA ✓") : "fails AA ✕"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── glass preset sliders + live preview ─────────────────────
const SLIDERS: Array<{ key: keyof GlassPreset; label: string; min: number; max: number; step: number }> = [
  { key: "blurPx", label: "Blur", min: 0, max: 60, step: 1 },
  { key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
  { key: "tintOpacity", label: "Frosted amount", min: 0, max: 1, step: 0.01 },
  { key: "saturation", label: "Saturation", min: 0, max: 3, step: 0.05 },
  { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.05 },
  { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.05 },
  { key: "refraction", label: "Glass / lens", min: 0, max: 1, step: 0.05 },
  { key: "highlightStrength", label: "Highlight", min: 0, max: 1, step: 0.05 },
  { key: "shadowStrength", label: "Shadow", min: 0, max: 1, step: 0.05 },
  { key: "borderWidthPx", label: "Border", min: 0, max: 4, step: 0.5 },
  { key: "activeGlow", label: "Active glow", min: 0, max: 1, step: 0.05 },
  { key: "transitionMs", label: "Animation (ms)", min: 0, max: 1000, step: 10 },
];

function GlassPresetEditor({ preset, onChange }: { preset: GlassPreset; onChange: (next: GlassPreset) => void }) {
  const css = glassPresetToCss(preset);
  return (
    <details className="rounded-lg border border-ink/10">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {preset.name}
      </summary>
      <div className="space-y-3 px-3 pb-3">
        {/* live preview over a busy backdrop — readability problems show here */}
        <div className="relative h-24 overflow-hidden rounded-lg" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(115deg,#B08842 0%,#1A1612 35%,#F5EFE3 60%,#6B655D 100%)" }}
          />
          <div className="absolute inset-x-6 bottom-3 flex h-12 items-center justify-around rounded-full px-4" style={css as React.CSSProperties}>
            {["For You", "Shop", "Journal", "Bag"].map((t, i) => (
              <span
                key={t}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-ink"
                style={i === 0 && preset.activeGlow > 0 ? { boxShadow: `0 0 ${Math.round(14 * preset.activeGlow)}px rgba(176,136,66,${0.8 * preset.activeGlow})` } : undefined}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {SLIDERS.map((s) => (
            <label key={s.key} className="block text-xs">
              <span className="flex justify-between">
                <span>{s.label}</span>
                <span className="font-mono text-muted">{String(preset[s.key])}</span>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={Number(preset[s.key])}
                onChange={(e) => onChange({ ...preset, [s.key]: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </label>
          ))}
          <label className="block text-xs">
            <span>Tint color</span>
            <input type="color" value={preset.tintColor.slice(0, 7)} onChange={(e) => onChange({ ...preset, tintColor: e.target.value })} className="mt-1 h-7 w-full cursor-pointer rounded border border-ink/15" />
          </label>
          <label className="block text-xs">
            <span>Border color</span>
            <input type="color" value={preset.borderColor.slice(0, 7)} onChange={(e) => onChange({ ...preset, borderColor: e.target.value })} className="mt-1 h-7 w-full cursor-pointer rounded border border-ink/15" />
          </label>
        </div>
        {preset.blurPx > 30 ? (
          <p className="rounded bg-accent/10 px-2 py-1 text-xs">⚠ Heavy blur costs GPU time on older phones — the Frosted preset reads better for less.</p>
        ) : null}
      </div>
    </details>
  );
}

function expandHex(short: string): string {
  return `#${[...short.replace("#", "")].map((c) => c + c).join("")}`.slice(0, 7);
}
