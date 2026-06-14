"use client";

// ============================================================
// Creation Studio — the hub (§30, Phase 1)
// ============================================================
// One front door for every offline tool/mode. Reads the Workshop
// launcher token (#token) once, keeps it in sessionStorage, and
// carries it forward to each tool so token-gated features (e.g. the
// offline-voice and save-to-drive sidecars) just work. All on-device.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { STUDIO_TOOLS, STUDIO_GROUPS } from "../tools.ts";
import { routeVibe, type RouteScore } from "../vibe-router.ts";

const TOKEN_KEY = "lusik_builder_local_token";
const SEED_KEY = "lusik_studio_vibe";

export function StudioHub() {
  const [token, setToken] = useState("");
  const [vibe, setVibe] = useState("");
  const [routed, setRouted] = useState(false);

  useEffect(() => {
    const m = /^#token=(.+)$/.exec(window.location.hash);
    if (m && m[1].length >= 16) {
      try { sessionStorage.setItem(TOKEN_KEY, m[1]); } catch { /* */ }
      window.history.replaceState(null, "", window.location.pathname);
    }
    try { setToken(sessionStorage.getItem(TOKEN_KEY) || ""); } catch { /* */ }
  }, []);

  // Same-origin tools read the token from sessionStorage, but appending it also
  // covers opening a tool in a new tab.
  const link = (href: string) => (token ? `${href}#token=${token}` : href);

  const result = useMemo(() => (vibe.trim() ? routeVibe(vibe) : null), [vibe]);

  // Open a mode, pre-seeding the vibe-capable builders with the prompt.
  const open = (r: RouteScore) => {
    if (r.seedable) { try { sessionStorage.setItem(SEED_KEY, JSON.stringify({ mode: r.mode, text: vibe })); } catch { /* */ } }
    window.location.href = link(r.route);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <h1 className="font-display text-3xl">🎨 Creation Studio</h1>
      <p className="mt-1 text-sm text-muted">Everything in one place — build websites & apps, make games and immersive pages, run your shop, prep conversations, and create media. All on this device, offline, and yours.</p>

      {/* Cross-mode vibe box: describe it → we open the right tool. */}
      <section className="mt-5 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">✨ Describe what you want to make</h2>
        <textarea value={vibe} onChange={(e) => { setVibe(e.target.value); setRouted(true); }} rows={2} placeholder='e.g. "a 3D restaurant homepage", "a customer system with barcodes", "a wedding photo booth"' className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none" aria-label="Describe what you want to make" />
        {routed && result ? (
          result.confident && result.best ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>Sounds like <strong>{result.best.label}</strong>.</span>
              <button type="button" onClick={() => open(result.best!)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream">Open it →</button>
              <span className="text-xs text-muted">or pick:</span>
              {result.choices.filter((c) => c.mode !== result.best!.mode).slice(0, 3).map((c) => <button key={c.mode} type="button" onClick={() => open(c)} className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">{c.label}</button>)}
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <p className="text-muted">Not sure which fits — choose one:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(result.choices.length ? result.choices : STUDIO_TOOLS.map((t) => ({ mode: t.href, label: t.name, route: t.href, seedable: false, score: 0 }))).slice(0, 6).map((c) => <button key={c.mode} type="button" onClick={() => open(c as RouteScore)} className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">{c.label}</button>)}
              </div>
            </div>
          )
        ) : null}
      </section>

      {STUDIO_GROUPS.map((g) => {
        const tools = STUDIO_TOOLS.filter((t) => t.group === g.id);
        return (
          <section key={g.id} className="mt-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {tools.map((t) => (
                <a key={t.href} href={link(t.href)} className="rounded-2xl border border-ink/10 bg-white/60 p-4 transition hover:bg-cream">
                  <span className="flex items-center gap-2 font-display text-lg"><span aria-hidden>{t.emoji}</span>{t.name}</span>
                  <span className="mt-1 block text-sm text-muted">{t.blurb}</span>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-8 rounded-lg bg-cream/70 px-3 py-2 text-[11px] text-muted">Offline-first &amp; private: these tools run on this device, store data locally, and don't upload anything on their own. Each opens with the same Workshop session.</p>
    </main>
  );
}
