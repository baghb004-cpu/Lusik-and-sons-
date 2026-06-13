# Private Offline Tax Assistant — architecture & honest boundaries (plan §25)

*A private, offline-first helper for preparing your OWN taxes legally and
confidently — an organizer, guide, and checker, not a tax preparer or an
e-file transmitter. Built for the family, runs from the thumb drive,
nothing leaves the device.*

## What this is — and the one design decision everything hangs on

**It does not invent tax numbers.** Standard deductions, brackets, credit
amounts and phase-outs change yearly and getting one wrong would hurt you.
So every figure lives in a **versioned rule pack** as a value that carries
its **official IRS source URL** and a **`verified` flag**. Until *you*
confirm a figure against the linked official document, the engine treats it
as "Needs review" and never produces a final number from it. The ships-with
pack is a **TEMPLATE** (structure + official source links + placeholders),
not a claim about any year's amounts. This is the honest, safe core: the
app does the **arithmetic, organizing, consistency-checking, and citing**;
the **authoritative numbers come from official sources you verify**.

## Safest architecture

- **Portable local web app**, same shell as the rest of the thumb drive
  (Node + browser UI, or the Tauri launcher). No account, no login, no
  server beyond `127.0.0.1`.
- **Local encrypted project file.** The whole tax project is one JSON blob
  encrypted at rest with **AES-256-GCM**, key derived from your passphrase
  via **scrypt** (implemented in `tax/crypto.ts`, Node's built-in crypto —
  no dependency). No passphrase, no decryption. "Delete all tax data" wipes
  the file and its OCR cache.
- **Versioned rule packs** as plain JSON under `tax/rule-packs/<year>.json`,
  each with a schema version and a `verified` status per figure.
- **Local PDF/packet generation** (the audit-ready packet) — pure assembly
  to Markdown/HTML, printed to PDF by the browser, never uploaded.
- **Network is opt-in and loud.** The only outbound action is the **"Open
  official IRS source" / "Check for a newer rule pack"** button, which
  opens an official URL in the browser; it warns first, and nothing about
  your data is ever sent.

## Folder structure (under the portable data dir, encrypted where noted)

```
portable/tax/
├── projects/                 # one encrypted file per person/year
│   └── 2026-baghdo.taxproj   # AES-256-GCM blob
├── documents/                # YOUR imported W-2s/1099s/receipts (local only)
│   └── 2026/…
├── ocr-cache/                # optional, local OCR text (deletable)
├── rule-packs/
│   ├── 2026.json             # versioned, source-cited, verified flags
│   └── _template.json        # the structure + official links (ships)
├── packets/                  # generated audit-ready packets
└── activity-log.json         # local-only plain log of what happened
```

## Data model (the shapes, in `tax/schemas.ts`)

- **TaxProject**: `{ taxYear, filingStatus, taxpayer, dependents[], income[],
  deductions[], credits[], answers{}, confirmations[], warnings[] }`.
- **TaxDocument**: `{ id, kind (W-2 / 1099-NEC / 1098-T / …), fields[],
  source: "imported"|"manual", confidence }` — every field individually
  confirmable; **OCR output is never trusted, always requires confirmation**.
- **Value + Confidence**: every derived number carries one of —
  `confirmed-document` · `confirmed-manual` · `calculated` · `needs-review`
  · `not-enough-info` — surfaced in the UI so nothing looks more certain
  than it is.
- **RuleFigure**: `{ key, value|null, unit, source (official URL),
  verified, note }`. The engine's contract: unverified or null ⇒ the
  dependent result is `needs-review`, not a number.

## Rule-pack format

```json
{
  "schemaVersion": 1, "taxYear": 2026, "jurisdiction": "us-federal",
  "status": "template",            // template | user-verified
  "figures": {
    "std_deduction_single": { "value": null, "unit": "usd",
      "source": "https://www.irs.gov/...", "verified": false,
      "note": "Enter from the official IRS instructions for your year." }
  },
  "formGuidance": [ /* general 'which form when' with citations */ ]
}
```

A pack with `status:"template"` or any `verified:false` figure makes the
app show an outdated/unverified banner and a one-click link to the official
source to fill it in.

## Privacy / security plan

- 100% local-first; **no analytics, no telemetry, no hidden calls** (the
  bundle-budget/editor-isolation discipline already proves no tracking
  ships). Outbound network is the single opt-in "open official source"
  button, with a warning.
- Project file **encrypted at rest** (AES-256-GCM + scrypt passphrase).
- **Permanent delete** wipes project + documents + OCR cache + log.
- **Local activity log** in plain language ("imported W-2", "confirmed box
  1", "generated packet") so you can see exactly what the app did.
- No third-party tax API unless you explicitly enable one (none ships).

## Limitations — what it CAN and CANNOT guarantee

**Can:** organize documents; explain forms/terms in plain language with
official citations; do standard-vs-itemized arithmetic from figures *you
verify*; flag missing docs, math errors, inconsistencies, and
documentation gaps; assemble an **audit-READY** packet (records + citations
+ worksheet + unresolved warnings).

**Cannot / does not:** it is **not a CPA, not tax/legal advice, not an
authorized e-file transmitter**, and it does **not** promise your return is
correct or "audit-proof." It cannot guarantee any number is the current
law — that's why figures are verified against official sources. Complex
situations (businesses, K-1s, rental depreciation, multi-state, foreign
income) are **out of scope**; it will say so and point you to a
professional or IRS resources. It supports **legal, accurate, good-faith
filing only** and refuses help with hiding income, fake deductions/
dependents/expenses, backdating, or evading tax.

## Phases

1. **Offline organizer + document checklist** ← built now (pure engine).
2. Guided interview + local data model ← data model built now; UI next.
3. Federal rule-pack engine for simple returns (std-vs-itemized, confidence).
4. Validation + audit-ready packet ← validation + packet assembly built now.
5. Optional state module (same rule-pack format, per-state files).
6. Optional export helpers for official routes (Free File Fillable Forms,
   print-and-mail) — never an unauthorized e-file path.
