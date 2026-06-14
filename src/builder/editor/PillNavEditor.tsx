"use client";

// ============================================================
// Pill-menu editor (Phase 8)
// ============================================================
// Dedicated controls for a selected pillNav block: buttons
// (add/remove/rename/reorder/icon/link, capped at 5), position,
// labels on/off, geometry sliders, and the glass preset picker —
// appearance itself is edited in the THEME panel (one preset,
// every pill), keeping structure and style separable.
// ============================================================

import { PILL_ICONS, newId, type GlassPreset } from "../schema/index.ts";

interface PillItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

export interface PillNavProps {
  items: PillItem[];
  position: "bottom" | "top";
  preset?: string;
  showLabels?: boolean;
  heightPx?: number;
  radiusPx?: number;
}

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export function PillNavEditor({
  value,
  glass,
  onChange,
}: {
  value: PillNavProps;
  glass: GlassPreset[];
  onChange: (next: PillNavProps) => void;
}) {
  const items = value.items ?? [];
  const setItem = (i: number, patch: Partial<PillItem>) =>
    onChange({ ...value, items: items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange({ ...value, items: next });
  };

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Pill menu</h4>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-lg border border-ink/10 bg-white/60 p-2">
            <div className="mb-1 flex items-center gap-1">
              <select
                value={item.icon}
                onChange={(e) => setItem(i, { icon: e.target.value })}
                className="rounded-lg border border-ink/15 bg-white/80 px-1.5 py-1 text-xs"
                aria-label="Icon"
              >
                {PILL_ICONS.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
              <input
                type="text"
                value={item.label}
                maxLength={14}
                onChange={(e) => setItem(i, { label: e.target.value })}
                className={inputClass}
                aria-label="Button label"
              />
              <span className="flex shrink-0 gap-1">
                <MiniBtn disabled={i === 0} onClick={() => move(i, -1)} label="Move up">↑</MiniBtn>
                <MiniBtn disabled={i === items.length - 1} onClick={() => move(i, 1)} label="Move down">↓</MiniBtn>
                <MiniBtn
                  disabled={items.length <= 2}
                  onClick={() => onChange({ ...value, items: items.filter((_, n) => n !== i) })}
                  label="Remove button"
                >
                  ✕
                </MiniBtn>
              </span>
            </div>
            <input
              type="text"
              value={item.href}
              onChange={(e) => setItem(i, { href: e.target.value })}
              placeholder="/shop, /journal, /cart…"
              className={`${inputClass} font-mono`}
              aria-label="Link target"
            />
          </div>
        ))}
        <button
          type="button"
          disabled={items.length >= 5}
          onClick={() =>
            onChange({ ...value, items: [...items, { id: newId(), icon: "star", label: "New", href: "/" }] })
          }
          className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream disabled:opacity-40"
        >
          + Add button {items.length >= 5 ? "(max 5 — thumb reach)" : ""}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Position</span>
          <select
            value={value.position}
            onChange={(e) => onChange({ ...value, position: e.target.value as "bottom" | "top" })}
            className={inputClass}
          >
            <option value="bottom">floating bottom</option>
            <option value="top">floating top</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Glass preset</span>
          <select
            value={value.preset ?? glass[0]?.name ?? ""}
            onChange={(e) => onChange({ ...value, preset: e.target.value })}
            className={inputClass}
          >
            {glass.map((g) => (
              <option key={g.name} value={g.name}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={value.showLabels !== false}
            onChange={(e) => onChange({ ...value, showLabels: e.target.checked ? undefined : false })}
            className="h-3.5 w-3.5 accent-ink"
          />
          Show labels
        </label>
      </div>

      {(
        [
          { key: "heightPx", label: "Height", min: 48, max: 80, fallback: 56 },
          { key: "radiusPx", label: "Roundness", min: 8, max: 40, fallback: 28 },
        ] as const
      ).map((s) => (
        <label key={s.key} className="block text-xs">
          <span className="flex justify-between">
            <span>{s.label}</span>
            <span className="font-mono text-muted">{value[s.key] ?? s.fallback}px</span>
          </span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={1}
            value={value[s.key] ?? s.fallback}
            onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) })}
            className="w-full accent-ink"
          />
        </label>
      ))}

      <p className="text-[11px] text-muted">
        Appearance (blur, frosted amount, glow…) lives in the Theme panel’s glass presets — pick which preset this pill wears above. Use the hit-box overlay to confirm nothing important sits underneath it.
      </p>
    </div>
  );
}

function MiniBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="rounded border border-ink/15 px-1.5 py-0.5 text-xs disabled:opacity-30">
      {children}
    </button>
  );
}
