"use client";

// ============================================================
// Creation Studio — the hub (§30, Phase 1)
// ============================================================
// One front door for every offline tool/mode. Reads the Workshop
// launcher token (#token) once, keeps it in sessionStorage, and
// carries it forward to each tool so token-gated features (e.g. the
// offline-voice and save-to-drive sidecars) just work. All on-device.
// ============================================================

import { useEffect, useState } from "react";
import { STUDIO_TOOLS, STUDIO_GROUPS } from "../tools.ts";

const TOKEN_KEY = "lusik_builder_local_token";

export function StudioHub() {
  const [token, setToken] = useState("");

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <h1 className="font-display text-3xl">🎨 Creation Studio</h1>
      <p className="mt-1 text-sm text-muted">Everything in one place — build websites & apps, make games and immersive pages, run your shop, prep conversations, and create media. All on this device, offline, and yours.</p>

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
