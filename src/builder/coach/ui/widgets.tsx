"use client";

// Small shared building blocks for Communication Coach views.

import { useState } from "react";
import { STYLES, type Style } from "../schemas.ts";

const STYLE_LABEL: Record<Style, string> = {
  simple: "Simple",
  friendly: "Friendly",
  professional: "Professional",
  confident: "Confident",
  short: "Shorter",
  beginner: "Beginner",
  "less-pushy": "Less pushy",
  "follow-up": "Follow-up",
};

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — user can select manually */
        }
      }}
      className={`rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream ${className}`}
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

/** Style chips — only the styles authored for this item are offered. */
export function StyleChips({ available, value, onChange }: { available: Style[]; value: Style; onChange: (s: Style) => void }) {
  const ordered = STYLES.filter((s) => available.includes(s));
  if (ordered.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`min-h-8 rounded-full border px-3 text-xs ${value === s ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}
        >
          {STYLE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg">{title}</h2>
      {subtitle ? <p className="mb-2 mt-0.5 text-xs text-muted">{subtitle}</p> : <div className="mb-2" />}
      {children}
    </section>
  );
}

export const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
export const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
