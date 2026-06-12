"use client";

// ============================================================
// Audit panel (roadmap #15) — every guardrail, one button
// ============================================================
// The checks already exist scattered across the engine (publish
// validation, WCAG contrast, the tap-target/layout scanner, i18n
// coverage); this panel runs them all against the open page and
// presents one prioritized list. Nothing here blocks — the save/
// publish gates still enforce; this is the "show me everything
// before I publish" view.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { pageWeight, PAGE_WEIGHT_BUDGET_BYTES, type MediaFileInfo } from "./pageWeight.ts";
import type { Page, Theme } from "../schema/index.ts";
import { validatePage, checkContrast } from "../engine/index.ts";
import { staticScan } from "../viewport/layoutIssueScanner.ts";
import { VIEWPORT_PRESETS } from "../viewport/viewportPresets.ts";
import { translationCoverage } from "../i18n/index.ts";
import type { LocaleCode } from "../i18n/locales.ts";
import { localeByCode } from "../i18n/locales.ts";

interface Finding {
  level: "error" | "warning" | "info";
  area: string;
  message: string;
}

const CONTRAST_PAIRS: Array<[string, string, string]> = [
  ["ink", "cream", "body text"],
  ["muted", "cream", "secondary text"],
  ["accent", "cream", "accent text"],
];

export function AuditPanel({
  api,
  page,
  theme,
  locales,
  defaultLocale,
}: {
  api?: (input: string, init?: RequestInit) => Promise<Response>;
  page: Page;
  theme: Theme | null;
  locales: LocaleCode[];
  defaultLocale: LocaleCode;
}) {
  const [ranAt, setRanAt] = useState<number | null>(null);
  const [media, setMedia] = useState<MediaFileInfo[] | null>(null);
  useEffect(() => {
    if (!ranAt || !api || media) return;
    api("/api/builder/media")
      .then(async (res) => (res.ok ? setMedia(((await res.json()) as { files: MediaFileInfo[] }).files) : setMedia([])))
      .catch(() => setMedia([]));
  }, [ranAt, api, media]);

  const findings = useMemo<Finding[]>(() => {
    if (!ranAt) return [];
    const out: Finding[] = [];

    // 1. publish validation (structure, alt text, pill/jumper rules)
    for (const i of validatePage(page).issues) {
      out.push({ level: i.level, area: "Structure", message: i.message });
    }

    // 2. layout scan on a small phone + a desktop (the extremes)
    for (const presetId of ["phone-compact", "desktop-laptop"]) {
      const preset = VIEWPORT_PRESETS.find((p) => p.id === presetId);
      if (!preset) continue;
      for (const i of staticScan(page, preset)) {
        out.push({
          level: i.severity === "critical" ? "error" : "warning",
          area: `Layout (${preset.label})`,
          message: i.message,
        });
      }
    }

    // 3. theme contrast (WCAG AA)
    const colors = theme?.tokens.colors ?? {};
    for (const [fg, bg, label] of CONTRAST_PAIRS) {
      if (!colors[fg] || !colors[bg]) continue;
      try {
        const r = checkContrast(colors[fg], colors[bg]);
        if (!r.passesAA) {
          out.push({ level: "warning", area: "Readability", message: `${label} (${fg} on ${bg}) is ${r.ratio.toFixed(1)}:1 — below WCAG AA` });
        }
      } catch {
        /* mid-edit invalid hex */
      }
    }

    // 4. translation coverage per enabled non-default locale
    for (const code of locales) {
      if (code === defaultLocale) continue;
      const cov = translationCoverage(page.sections, code);
      if (cov.total > 0 && cov.translated < cov.total) {
        out.push({
          level: "info",
          area: "Languages",
          message: `${localeByCode(code)?.endonym ?? code}: ${cov.translated}/${cov.total} text fields translated`,
        });
      }
    }

    // 5. page weight (uploaded media this page references)
    if (media && media.length > 0) {
      const w = pageWeight(page, media);
      if (w.refs.length > 0) {
        out.push({
          level: w.over ? "warning" : "info",
          area: "Performance",
          message: `${w.refs.length} uploaded photo(s) ≈ ${(w.bytes / 1024 / 1024).toFixed(1)} MB${w.over ? ` — over the ${(PAGE_WEIGHT_BUDGET_BYTES / 1024 / 1024).toFixed(1)} MB budget; resize the biggest before publishing` : " — within budget"}`,
        });
      }
    }

    return out.sort((a, b) => ["error", "warning", "info"].indexOf(a.level) - ["error", "warning", "info"].indexOf(b.level));
  }, [ranAt, page, theme, locales, defaultLocale, media]);

  const counts = {
    error: findings.filter((f) => f.level === "error").length,
    warning: findings.filter((f) => f.level === "warning").length,
  };

  return (
    <details className="rounded-xl border border-ink/10 bg-white/50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Audit
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => setRanAt(Date.now())}
          className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream hover:opacity-90"
        >
          {ranAt ? "Re-run all checks" : "Run all checks"}
        </button>
        {ranAt ? (
          findings.length === 0 ? (
            <p className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-900">✓ Structure, layout, readability and languages all clean.</p>
          ) : (
            <>
              <p className="text-[11px] text-muted">
                {counts.error} error{counts.error === 1 ? "" : "s"} · {counts.warning} warning{counts.warning === 1 ? "" : "s"} · {findings.length - counts.error - counts.warning} note{findings.length - counts.error - counts.warning === 1 ? "" : "s"}
              </p>
              <ul className="space-y-1">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <span aria-hidden="true">{f.level === "error" ? "⛔" : f.level === "warning" ? "⚠️" : "ℹ️"}</span>
                    <span>
                      <span className="font-medium">{f.area}:</span> {f.message}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
      </div>
    </details>
  );
}
