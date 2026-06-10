# Lusik & Sons — Replit app (`replit` branch only)

The iOS app (`ios/` on this branch), rebuilt identical for the web with
React + CSS: same four tabs, same Liquid Glass chrome, same immersive
product pages, same Stripe checkout against the same live backend.
Runnable and hostable on Replit out of the box.

**This directory exists only on the `replit` branch and is never merged
to `main`. Nothing here can affect lusikandsons.com.**

## Run it

**On Replit:** import this GitHub repo, choose the `replit` branch, press
**Run**. The root `.replit` config installs and starts the Vite dev
server from this directory automatically.

**Locally:**

```bash
cd replit-app
npm install
npm run dev        # http://localhost:3000
```

## Working model

All planning state lives in [`ROADMAP.md`](./ROADMAP.md) — eleven chunks
(0–10) mirroring the iOS roadmap one-for-one, each sized for a short
session. The matching Swift file in `ios/` is the spec for every chunk.
To resume, tell any session: *"Continue the Replit app —
replit-app/ROADMAP.md on the `replit` branch, next unchecked chunk."*

## Fold readiness

Both this app and the iOS app are laid out ahead of the book-style
iPhone Fold (7.8" 4:3 inner display + 5.5" cover screen): compact
layouts for phones and the cover, "open book" layouts (two-page product
spreads, paired-up grids, capped pill nav) for the unfolded canvas.
Resize the window across 700px — or open it on any tablet — to see the
expanded layouts today. Details in `src/lib/useFoldLayout.js` and the
roadmap's fold section.
