# §28 — Communication Coach (offline professional-communication mode)

*Status: Phases 1–3 BUILT + verified (offline engine + content, the full UI for
both sub-modes, and Live Call Assist incl. the optional consent-first Microphone
Assist, the proposal builder, and per-lead follow-up drafts). Remaining: Phase 4
polish (deeper roleplay/personas, dedicated post-call/post-interview summary
screens, import/export, optional local STT sidecar for true-offline mic).
Offline-first,
privacy-first, honesty-first. No cloud AI, no APIs, no telemetry — the whole
"conversation brain" is local data + pure functions, exactly like the Tax
Assistant and Media Studio modules.*

## Final naming (recommended)

- **Communication Coach** — the top-level mode (the label users see; internally
  "Communication Coach Mode" is fine).
  - **Client Outreach Coach** — sub-mode 1 (selling/offering website services).
    - **Live Call Assist** — the optional in-call helper (subtitle: "Room
      Microphone Coach" so the mechanism is honest).
  - **Interview Coach** — sub-mode 2 (interviews, client meetings, professional
    conversations).

Rationale: "Communication Coach / Client Outreach Coach / Interview Coach" is
the clearest of the alternatives, reads as one coherent feature, and the word
*Coach* (not *Assistant*/*AI*) sets the right expectation: it practices and
prepares you, it doesn't pretend to be a live cloud brain.

## The non-negotiable intent (baked into the content + a guardrail layer)

This is a coach for speaking **honestly, clearly, politely, and confidently** —
never a tool to lie, scam, pressure, spam, fake experience, manipulate, or
secretly record. Two concrete mechanisms enforce this:

1. **The content itself models honesty.** Every script/answer is written calm and
   non-pushy; each topic carries an explicit "avoid saying" list (e.g. "I
   guarantee more customers", "your website is terrible") paired with honest
   alternatives.
2. **A guardrail function** (`safety.ts`) scans a user's own drafted line for
   over-promise / pushy / dishonest patterns and suggests an honest rewrite —
   it coaches *away* from manipulation rather than enabling it.

## Where it lives (fits existing conventions)

- Module: `src/builder/coach/` — pure engine + bundled content + tests (no React).
- Route: `app/tools/coach/page.tsx` → `CoachRoute` (client, `ssr:false`,
  `robots:{index:false}`), same shell pattern as `/tools/tax` and
  `/tools/media-studio`. Reachable from the Workshop launcher.
- **Fully client-side & offline.** Core needs no server, no token, no network.
  Trackers persist in `localStorage` (offline-first; works by just opening the
  app). Export/import of trackers is a JSON file download/upload (no cloud).
- Editor-isolation: the coach is a tool, not editor code — it must never import
  `src/builder/editor/*` (the bundle-budget sentinel enforces this).

## Module architecture (`src/builder/coach/`)

```
schemas.ts     zod types: Scenario, Objection, ResponseVariant, Script,
               InterviewQuestion, AnswerFramework, RoleplayNode, FollowUpTemplate,
               ServicePackage, OutreachLead, InterviewLead, CoachVariables
variables.ts   [PLACEHOLDER] replacement with safe, labelled fallbacks
match.ts       offline keyword/intent matching: free text → best objection/intent
styles.ts      response-style selection (simple/friendly/professional/confident/
               short/beginner/less-pushy/follow-up) over a variant set
safety.ts      honesty guardrail: flag pushy/over-promise/dishonest phrasing,
               suggest honest rewrites (the "avoid → prefer" brain)
roleplay.ts    branching tree stepping + simple practice scoring + reflection
engine.ts      ties it together: suggestReplies(), fillScript(), scoreAnswer()
data/
  outreach.ts  scenarios, objections (all listed) w/ multi-style replies, call +
               voicemail scripts, follow-ups (text/email/DM), service packages,
               business types, avoid/prefer phrase lists, FAQ
  interview.ts questions w/ multi-style example answers, frameworks (STAR /
               beginner / experience), interview types, roleplay personas, prep
               checklist, follow-up templates, avoid list, confidence prompts
  privacy.ts   the microphone/consent disclosure copy (single source of truth)
index.ts       barrel
```

Tests: `src/builder/__tests__/coach.test.ts` — variable fill (unfilled →
labelled placeholder, never blank), phrase match picks the right objection,
style switching returns the requested register, safety flags the banned phrases
and passes honest ones, roleplay stepping + scoring, content integrity
(every objection has ≥1 reply, every question ≥1 answer, no empty templates).

## Data model (zod) — the shapes

- **ResponseVariant** `{ style: Style; text: string }` — `Style =
  "simple"|"friendly"|"professional"|"confident"|"short"|"beginner"|"less-pushy"|"follow-up"`.
- **Objection** `{ id; says: string; replies: ResponseVariant[]; tags: string[] }`.
- **Scenario** `{ id; title; situation; openingScript; tips: string[]; relatedObjections: string[] }`.
- **Script** `{ id; kind: "call"|"voicemail"|"text"|"email"|"dm"|"proposal"; title; body (with [VARS]) }`.
- **InterviewQuestion** `{ id; question; answers: ResponseVariant[]; framework?: string; tips: string[] }`.
- **AnswerFramework** `{ id; name; steps: {label; hint}[]; example }` (STAR, beginner, experience).
- **RoleplayNode** `{ id; persona; prompt; choices: {label; nextId?; feedback; score}[] }`.
- **FollowUpTemplate** `{ id; channel; subject?; body }`.
- **ServicePackage** `{ id; name; summary; includes: string[]; startingNote }` (no fixed prices — honest "starting" language, user fills the quote).
- **CoachVariables** — the fill-in map (USER_NAME, BUSINESS_NAME, …); persisted in localStorage so scripts auto-fill.
- **OutreachLead / InterviewLead** — tracker rows (fields + status enums per the spec).

## Variable system

`[UPPER_SNAKE]` tokens. `fillTemplate(text, vars)` replaces known vars; an
**unfilled** var renders as a clear bracketed label (e.g. `[your name]`) so a
script is never silently blank and the user sees exactly what to personalize.
A `missingVars(text, vars)` helper drives a "fill these in" checklist.

## Phrase / intent matching (offline, deterministic)

`match.ts` holds a keyword→intent table. The user types what the business said
("we already have a guy") → lowercase, tokenize, score each objection by keyword
hits (with a few synonyms) → return the best match (+ confidence) or "unsure →
here are the common ones." No ML, no network — a transparent scorer with a test
pinning the mappings.

## Response-style switching

Each objection/question carries several `ResponseVariant`s. The UI's
"make it shorter / friendlier / more professional / less pushy" buttons select
the matching variant; if a requested style isn't authored, `styles.ts` falls
back to the closest (e.g. less-pushy → friendly → simple) — never empty.

## Roleplay (kept simple)

A node map per persona; each node shows the interviewer/owner line and 2–4
reply choices; choosing advances to `nextId` and accrues a score with
per-choice `feedback`. End → a reflection summary (what went well, one thing to
try next time). Difficulty = which node set. No branching-tree engine beyond a
plain id→node lookup.

## Live Call Assist (Part 2) — honest mechanism, optional, later phase

Designed exactly as specified and **off by default**:
- Primary input is **"Type what they said"** → `match.ts` → suggested replies.
  This needs no mic and ships in Phase 1's engine.
- **Microphone Assist** is optional and consent-gated: it listens to *room*
  audio (speakerphone), never connects to the call, never records by default.
  STT uses the browser's on-device `SpeechRecognition` **only if present**;
  otherwise it degrades to typing (honest "not available offline here"). A
  persistent on-screen indicator shows when the mic is live; the disclosure copy
  in `privacy.ts` is shown before first use. No audio is saved; only optional
  text notes, clearly labelled. (Phase 3.)

## Trackers (Part 3 / Part 6)

Two beginner-friendly local lists (Outreach, Interview) with the specified
fields + status enums, stored in `localStorage`, with JSON export/import. Not a
CRM — a simple table + a per-row "post-call / post-interview summary" card that
also drafts the follow-up via the template engine.

## Generators

- **Follow-up generator** — pick channel (text/email/DM) + a lead → filled
  template, copy to clipboard.
- **Proposal / service-package builder** — pick package(s) → a plain outline
  with honest "starting at / quote after we talk" language; copy/export.

## UI structure (built after the engine; kept light, not 16 heavy screens)

`/tools/coach` → **Dashboard** (two big cards: Client Outreach / Interview;
plus "My details" for variables, and Settings & Privacy). Each sub-mode is a
single scrollable workspace with quick-action chips at top, a
scenario/question picker, the suggested-reply panel with style chips, and links
to the tracker + generators. Mobile-first, accessible (real buttons, labels,
focus states), fast.

## Phases (don't over-engineer — core first)

1. **Offline brain** *(building now)*: schemas, variables, match, styles, safety,
   roleplay, engine, the outreach + interview content packs, tests.
2. **UI**: dashboard, Client Outreach Coach, Interview Coach, variables panel,
   follow-up + proposal generators, the two trackers (localStorage), the
   `/tools/coach` route, privacy/settings screen.
3. **Live Call Assist**: "type what they said" wired to the matcher; then the
   optional, consent-gated Microphone Assist (on-device STT where available)
   with the indicator + disclosures; fallback typing always present.
4. **Polish**: roleplay scoring/reflection depth, more content variants, more
   personas, import/export, optional sync (only if/when a backend exists —
   never required).

## Safety / privacy / legal summary

- Honesty modeled in content + enforced by the guardrail; explicit "avoid"
  lists everywhere.
- Mic: opt-in, consent-first, visible indicator, no secret listening/recording,
  no audio saved by default, "follow local laws / get permission" reminder.
- All data local (localStorage + file export); no telemetry; works fully offline.
- Never positions itself as covert interview help — Practice/Notes framing only.
