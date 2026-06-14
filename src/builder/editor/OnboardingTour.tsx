"use client";

// ============================================================
// First-run tour (roadmap #4) — five calm steps, then gone
// ============================================================
// Shows once (localStorage flag), is skippable at every step,
// and teaches the five flows that make the Workshop click:
// open → edit → devices → photos → publish. No spotlight
// gymnastics — short cards a first-timer actually reads.
// ============================================================

import { useState } from "react";

export const TOUR_DONE_KEY = "bt_tour_done_v1";

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Welcome to Baghdo's Workshop 👋",
    body: "Everything you build here is plain files in your project — on a thumb drive, a home server, or GitHub. Every save runs the same validators the site's build uses, so you can't break what's live by clicking around.",
  },
  {
    title: "Open a page, click a block",
    body: "Pick a document on the left (try the starter templates under “+ New page”). Click any block in the preview and a real form opens on the right — title, photo, colors, links. No code, no JSON.",
  },
  {
    title: "Phones get their own polish",
    body: "The desktop/tablet/mobile toggle up top switches the preview. Tablet and mobile edits live in a separate layer — they can never damage your desktop layout. The ▢ Screens button grades your page on dozens of real-world screen sizes.",
  },
  {
    title: "Photos, languages, the look",
    body: "🖼 Media: drag photos in, use them anywhere. The ✏️ selector translates any text into your enabled languages. The theme document drives colors, glass, and Day/Night/Candlelight modes.",
  },
  {
    title: "Save, audit, export",
    body: "⌘S saves through the gates. The Audit panel runs every check (structure, layout, readability, translations) in one click. Export writes a complete site — static HTML, installable app (PWA), Next.js, or a native iOS project. Press ? anytime for help.",
  },
];

export function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const finish = () => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* private mode — the tour just shows again next time */
    }
    onDone();
  };
  const s = STEPS[step];
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-6 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label="Welcome tour">
      <div className="w-full max-w-md rounded-2xl bg-cream p-5 shadow-float">
        <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-accent">
          {step + 1} / {STEPS.length}
        </p>
        <h2 className="font-display text-xl">{s.title}</h2>
        <p className="mt-2 text-sm text-muted">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
            Skip the tour
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm hover:bg-white">
                Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
                Next
              </button>
            ) : (
              <button type="button" onClick={finish} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
                Start building
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
