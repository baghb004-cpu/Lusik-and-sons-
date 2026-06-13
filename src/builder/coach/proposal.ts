// ============================================================
// Communication Coach — proposal builder (pure)
// ============================================================
// Turn chosen service packages into a plain, honest proposal the
// user can copy and send. No fixed/guaranteed prices — "starting"
// language only, and a clear "I'll quote after we talk" close.
// Variables fill from the user's saved details.
// ============================================================

import type { ServicePackage, CoachVariables } from "./schemas.ts";
import { fillTemplate } from "./variables.ts";
import { SERVICE_PACKAGES } from "./data/outreach.ts";

export interface ProposalOptions {
  /** Optional free-text note about what the user noticed / discussed. */
  intro?: string;
}

/** Build a clean proposal from chosen package ids + the user's details. */
export function buildProposal(packageIds: string[], vars: CoachVariables = {}, opts: ProposalOptions = {}, packages: ServicePackage[] = SERVICE_PACKAGES): string {
  const chosen = packageIds.map((id) => packages.find((p) => p.id === id)).filter((p): p is ServicePackage => !!p);
  const business = fillTemplate("[BUSINESS_NAME]", vars);
  const name = fillTemplate("[USER_NAME]", vars);
  const contact = [fillTemplate("[USER_PHONE]", vars), fillTemplate("[USER_EMAIL]", vars)].filter((s) => !s.startsWith("[")).join(" · ");

  const lines: string[] = [];
  lines.push(`Website proposal for ${business}`);
  lines.push(`Prepared by ${name}${contact ? ` — ${contact}` : ""}`);
  lines.push("");
  if (opts.intro && opts.intro.trim()) {
    lines.push(opts.intro.trim());
    lines.push("");
  }
  if (chosen.length === 0) {
    lines.push("What I can help with: a clean, modern, mobile-friendly website (or an update to your current one).");
  } else {
    lines.push("What I can help with:");
    for (const p of chosen) {
      lines.push("");
      lines.push(`• ${p.name} — ${p.summary}`);
      for (const item of p.includes) lines.push(`   - ${item}`);
      lines.push(`   (${p.startingNote})`);
    }
  }
  lines.push("");
  lines.push("Next step: once we confirm the pages, photos, and features you want, I'll send a clear written quote — no surprises, and no pressure at all.");
  lines.push("");
  lines.push(`Thank you,`);
  lines.push(name);
  return lines.join("\n");
}
