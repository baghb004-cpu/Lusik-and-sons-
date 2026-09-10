# The design system

How color, contrast and motion are decided on this site, and which token to
reach for. `SITE_OVERHAUL_HANDOFF.md` section 11.2 is the ambition; this file
is what actually ships.

The tokens live in the `COLOR TOKENS` block at the top of
`src/styles/index.css`. Two tests keep this document honest, and both fail the
build rather than warning:

| Test | What it proves |
| --- | --- |
| `netlify/functions/_lib/__tests__/token-contrast.test.mjs` | Every token pairing clears its gate, in both atmospheres. Reads the real stylesheet. |
| `tests/e2e/contrast.spec.mjs` | The pages actually use those tokens. Walks every visible text node on ten routes, in both atmospheres, on desktop and mobile. |

## Two atmospheres

"Morning at the table" is the default: linen ground, ink text. "Evening at the
table" is dark mode, reached by the footer theme toggle or the system setting.
It is warm dark, not stark black, because the brand is warm.

Every token has a value in both. A token defined only in `:root` silently keeps
its light value in dark, which is exactly how the desktop mega-menu came to
render cream text on a cream panel. The token test now asserts the two blocks
declare the same names.

## Which token for text

The trap is the gold. `--accent` (`#B08842`) is the brand gold and reads
**2.8:1 on cream** — deliberately below AA. It is for borders, icons, fills and
underlines, never for text on a light ground. Three tokens exist so you never
have to think about it twice:

| Token | Use it when the text sits on | Light | Dark |
| --- | --- | --- | --- |
| `--accent-text` | a normal page surface (page, card, footer, hover row) | `#826027` | `#C9A678` |
| `--accent-on-ink` | an `--ink` panel | `#B08842` | `#826027` |
| `--text-on-accent` | a gold fill, e.g. the cart-count badge | `#1A1612` | `#1A1612` |

`--accent-on-ink` looks inverted because it is. An `--ink` panel flips with the
theme: dark in light mode, cream in dark mode. The gold on top has to flip with
it, exactly as `--text-on-ink` already does. Reaching for `--accent` inside an
ink panel is the bug that put bright gold on cream at 2.0:1 on the Story page.

For everything else: `--text-primary` for body copy, `--text-secondary` for
running paragraphs, `--text-muted` for captions and meta. All three clear their
gate on every background token in both atmospheres.

## Which token for borders

`--border-default` is a decorative separator and has no contrast obligation.

`--border-strong` is the boundary of an **interactive control** — an input, an
unselected swatch, the quantity stepper. WCAG 1.4.11 asks for 3:1 on a boundary
that is the only thing identifying a control, and a white field on a cream page
is 1.1:1 on its own, so the border carries all of it. It was 0.20 alpha (1.5:1)
and is now 0.50 in light, 0.40 in dark.

## The gates

From the plan, and encoded in `GATES` in `src/lib/contrast.js`:

- **7:1** running body copy
- **4.5:1** any other text
- **3:1** large text (24px+, or 18.66px+ bold) and control boundaries

`src/lib/contrast.js` is plain JavaScript rather than TypeScript so the Node 20
test runner can import it, the same reason `leadTime.js` and
`capabilityTier.js` are. It composites translucent colors over their backdrop
before scoring — half the text tokens are `rgba()` over the page cream, and
scoring them without that step reports a ratio for a color that never appears
on screen.

## What the page audit deliberately does not score

Each of these is a judgement, not a convenience. They are exemptions in
`tests/e2e/contrast.spec.mjs`:

- **`aria-hidden` subtrees.** Decoration carrying no information: the alphabet
  marquee (which also sits at `opacity: 0.14`), and the `■` color chips, which
  are always immediately followed by the color's name as real text.
- **`role="img"` subtrees.** The blanket preview and the preset swatches render
  the customer's chosen thread on the chosen cloth. Cream thread on cream
  waffle genuinely does read softly, and "correcting" it would misrepresent
  what ships. Both carry an `aria-label`, and the color names sit beside them
  as text, so color is never the only signal.
- **Text over a background image.** A photo or gradient cannot be scored from
  computed styles. These are counted and reported as a test annotation rather
  than dropped, so the number cannot quietly grow. Each one needs a scrim and a
  human eye — the immersive sheet's title has both.
- **The wordmark.** WCAG exempts text that is part of a logo.

### The visual suite does not guard color

`playwright.visual.config.mjs` allows `maxDiffPixelRatio: 0.02`. Recoloring
small text across a long full-page screenshot moves well under 2% of pixels, so
the baselines neither fail nor get rewritten. That is the right tolerance for
catching gross breakage, but it means the visual suite is not a color guard —
the two contrast gates are. Do not read "baselines unchanged" as "the palette
did not move".

### What the audit cannot reach

It walks what a page renders on load. A surface that only appears on a timer or
after an interaction is invisible to it — the "Text us" panel is the example,
and it carried the same hardcoded-cream bug as the mega-menu without ever
failing a test. For those, the token discipline above is the only guard: if a
surface sits under text that reads from a token, its background must read from
one too.

To exempt something new, prefer `aria-hidden` or `role="img"` where either is
honest. `data-contrast-exempt="<reason>"` exists as an escape hatch; the reason
string shows up in the audit, so make it a sentence you would defend.

## Motion

Durations are 120ms for a state flip, 240ms for a panel or sheet, 400ms for a
page-level reveal. One spring for finger-driven movement, one ease for content.
Every decorative animation checks `prefers-reduced-motion`, and the capability
ladder (`docs` in `CLAUDE.md`, `src/lib/capability.ts`) turns decorative motion
off entirely at the `lean` tier and collapses transitions to a cut at `core`.

## Deliberately not done yet

The plan asks for more than this, and the rest is blocked on things code cannot
supply:

- **An OKLCH palette re-derived from the real cloth** (11.2, "derive from the
  cloth, not from a swatch book") needs the physical materials measured — the
  waffle, the terry, the six knit body colors, the satin. Converting the
  existing hexes to OKLCH without that measurement would be notation change
  dressed as color science, and it would move every visual baseline for
  nothing. The brand hexes are also load-bearing for the printed brochure.
- **Thread-truth chips** (each DMC color rendered as it looks on white terry
  and on waffle) need the poster script that arrives with the Loom in PR 2.
- **Color-blind simulation in the visual suite** (protan, deutan, tritan) is
  worth doing once the thread picker is rebuilt on the Loom, rather than
  baselining a picker that is about to be replaced.
- **A `prefers-contrast: more` AAA atmosphere** is a small, self-contained
  follow-up now that the gates exist to verify it.
