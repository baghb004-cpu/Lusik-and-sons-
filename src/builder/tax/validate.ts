// ============================================================
// Tax Assistant — validation engine (pure, plan §25 #5)
// ============================================================
// Safe, defensible checks only — math, consistency, missing
// documents, documentation gaps. It NEVER asserts a tax-law
// threshold; it surfaces things for the user to review and points
// at the relevant document. "audit-ready", not "audit-proof".
// ============================================================

import { neededDocuments } from "./checklist.ts";
import type { DocKind, TaxProject } from "./schemas.ts";

export interface TaxWarning {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  fix: string;
}

const present = (project: TaxProject, kind: DocKind) => project.documents.some((d) => d.kind === kind);

export function validateProject(project: TaxProject): TaxWarning[] {
  const w: TaxWarning[] = [];
  const a = project.answers;

  // filing status present
  if (!project.filingStatus) {
    w.push({ level: "error", code: "no-filing-status", message: "No filing status chosen yet.", fix: "Pick single / married / head of household — it drives nearly every number." });
  }

  // missing income documents implied by the interview
  const expect: Array<[string, DocKind, string]> = [
    ["had-job", "W-2", "You said you had a job — add each W-2."],
    ["self-employed", "1099-NEC", "You said you did self-employed work — add any 1099-NEC (and remember cash income still counts)."],
    ["bank-interest", "1099-INT", "You said your bank paid interest — add the 1099-INT."],
    ["investments", "1099-DIV", "You said you have investments — add the 1099-DIV."],
    ["unemployment", "1099-G", "You said you got unemployment — add the 1099-G."],
    ["marketplace-insurance", "1095-A", "Marketplace insurance REQUIRES a 1095-A or the return stalls — add it."],
  ];
  for (const [ans, kind, fix] of expect) {
    if (a[ans] === true && !present(project, kind)) {
      w.push({ level: ans === "marketplace-insurance" ? "error" : "warning", code: `missing-${kind}`, message: `Expected a ${kind} based on your answers, but none is imported.`, fix });
    }
  }

  // unconfirmed OCR fields
  const unconfirmed = project.documents.flatMap((d) => d.fields).filter((f) => f.confidence === "needs-review").length;
  if (unconfirmed > 0) {
    w.push({ level: "warning", code: "unconfirmed-ocr", message: `${unconfirmed} scanned value(s) are not confirmed yet.`, fix: "Open each document and confirm or correct every number — scanned text is never trusted automatically." });
  }

  // duplicate documents (same kind + same key box value)
  const seen = new Set<string>();
  for (const d of project.documents) {
    const k = `${d.kind}:${d.fields.find((f) => /box\s*1|wages|amount/i.test(f.label))?.value ?? d.id}`;
    if (seen.has(k)) w.push({ level: "warning", code: "duplicate-doc", message: `Possible duplicate ${d.kind}.`, fix: "Check you didn't import the same form twice — it would double-count income." });
    seen.add(k);
  }

  // itemized deductions large vs income → review (NOT an accusation)
  const incomeCents = project.income.reduce((s, i) => s + i.amountCents, 0);
  const itemizedCents = project.deductions.filter((d) => d.itemized).reduce((s, d) => s + d.amountCents, 0);
  if (incomeCents > 0 && itemizedCents > incomeCents * 0.6) {
    w.push({ level: "warning", code: "high-deductions", message: "Itemized deductions are large compared to income.", fix: "Double-check each one is real and you have the receipts — unusually high deductions draw attention." });
  }

  // charitable donation documentation
  if (a.donated === true && !present(project, "donation-record")) {
    w.push({ level: "warning", code: "donation-docs", message: "You plan to deduct donations but have no donation records imported.", fix: "Keep written acknowledgment for gifts (especially $250+). No record, no deduction." });
  }

  // self-employment tax reminder
  if (a["self-employed"] === true) {
    w.push({ level: "info", code: "se-tax", message: "Self-employment usually owes self-employment tax (Schedule SE) and may need quarterly estimated payments.", fix: "Set aside money for SE tax; check whether estimated payments were due." });
  }

  // dependent vs filing-status sanity
  if (project.filingStatus === "head-of-household" && project.dependents === 0) {
    w.push({ level: "warning", code: "hoh-no-dependent", message: "Head of Household usually requires a qualifying dependent.", fix: "Confirm you have a qualifying person — otherwise the filing status may be wrong." });
  }

  // gather-list reminder for anything the interview implies but isn't in yet
  const stillNeeded = neededDocuments(a).filter((item) => {
    const map: Record<string, DocKind> = { w2: "W-2", "1099-nec": "1099-NEC", "1099-int": "1099-INT", "1099-div": "1099-DIV", "1098-t": "1098-T", "1095-a": "1095-A" };
    const kind = map[item.id];
    return kind && !present(project, kind);
  });
  if (stillNeeded.length > 0) {
    w.push({ level: "info", code: "gather", message: `Still to gather: ${stillNeeded.map((i) => i.doc).join("; ")}.`, fix: "Collect these before filing so nothing is missed." });
  }

  return w;
}
