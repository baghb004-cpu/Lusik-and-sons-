// ============================================================
// Tax Assistant — audit-READY packet assembly (pure, plan §25 #6)
// ============================================================
// Builds a plain-Markdown packet from a project: income/deduction/
// credit summaries, documents used, user confirmations, the
// std-vs-itemized worksheet, unresolved warnings, a filing
// checklist, and a record-retention checklist. The browser prints
// it to PDF locally — nothing is uploaded. "Audit-ready" = your
// records are organized and cited, NOT a promise of correctness.
// ============================================================

import { compareDeductions, projectConfidence, sumCents } from "./engine.ts";
import { validateProject } from "./validate.ts";
import { likelyForms } from "./checklist.ts";
import type { RulePack, TaxProject } from "./schemas.ts";

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function buildPacket(project: TaxProject, pack: RulePack | null): string {
  const income = sumCents(project.income);
  const credits = sumCents(project.credits);
  const cmp = compareDeductions(project, pack);
  const warnings = validateProject(project);
  const conf = projectConfidence(project);
  const L: string[] = [];

  L.push(`# Tax records packet — ${project.taxYear}`);
  L.push(`Prepared with a private offline assistant. **This is an organized record set with official-source citations — not tax advice, not a guarantee of correctness, and not an e-filed return.**`);
  L.push(`Filing status: ${project.filingStatus ?? "(not set)"} · Dependents: ${project.dependents}`);
  if (pack) L.push(`Rule pack: ${pack.jurisdiction} ${pack.taxYear} (${pack.status})`);
  L.push("");

  L.push("## Income summary");
  for (const i of project.income) L.push(`- ${i.label}: ${usd(i.amountCents)}  _(${i.confidence})_`);
  L.push(`- **Total income: ${usd(income.cents)}**  _(${income.confidence})_`);
  L.push("");

  L.push("## Deduction decision (standard vs itemized)");
  L.push(`- Itemized total: ${usd(cmp.itemizedCents)}  _(${cmp.itemizedConfidence})_`);
  L.push(`- Standard deduction: ${cmp.standardCents === null ? "**needs a verified figure**" : usd(cmp.standardCents)}`);
  L.push(`- Recommendation: **${cmp.recommendation}**`);
  L.push(`- ${cmp.explanation}`);
  L.push("");

  L.push("## Credits summary");
  if (project.credits.length === 0) L.push("- (none recorded)");
  for (const c of project.credits) L.push(`- ${c.label}: ${usd(c.amountCents)}  _(${c.confidence})_`);
  L.push("");

  L.push("## Documents used");
  if (project.documents.length === 0) L.push("- (none imported)");
  for (const d of project.documents) L.push(`- ${d.kind}${d.label ? ` — ${d.label}` : ""} (${d.source}, ${d.fields.length} field(s))`);
  L.push("");

  L.push("## Forms you'll likely touch");
  for (const f of likelyForms(project.answers)) L.push(`- ${f.form} — ${f.plain}  \n  Source: ${f.source}`);
  L.push("");

  L.push("## Your confirmations");
  if (project.confirmations.length === 0) L.push("- (none yet — confirm your numbers before filing)");
  for (const c of project.confirmations) L.push(`- ${c.what} — ${new Date(c.at).toLocaleString()}`);
  L.push("");

  L.push("## Confidence breakdown");
  for (const [k, n] of Object.entries(conf)) if (n > 0) L.push(`- ${k}: ${n}`);
  L.push("");

  L.push("## Unresolved warnings");
  if (warnings.length === 0) L.push("- None outstanding.");
  for (const wn of warnings) L.push(`- ${wn.level === "error" ? "⛔" : wn.level === "warning" ? "⚠️" : "ℹ️"} ${wn.message}  \n  → ${wn.fix}`);
  L.push("");

  L.push("## Filing checklist");
  L.push("- [ ] Names & SSNs match Social Security cards exactly");
  L.push("- [ ] Every income document above is entered and confirmed");
  L.push("- [ ] Standard vs itemized decision reviewed");
  L.push("- [ ] All warnings above resolved or understood");
  L.push("- [ ] Math reviewed on the official form (Free File Fillable Forms or your chosen route)");
  L.push("- [ ] You believe everything is accurate and good-faith");
  L.push("");

  L.push("## Record-retention checklist");
  L.push("- [ ] Keep this packet + every source document for at least 3 years (longer for property/business)");
  L.push("- [ ] Store the encrypted project file somewhere safe (and a backup)");
  L.push("- [ ] Note the date and method you filed");
  L.push("");

  L.push("---");
  L.push("_Generated locally. No data left this device. For anything complex (a business, rental property, multi-state, K-1s, foreign income), consult a tax professional or the official IRS resources cited above._");
  return L.join("\n");
}
