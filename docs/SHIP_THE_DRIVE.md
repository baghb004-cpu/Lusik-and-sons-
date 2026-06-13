# Put Baghdo's Workshop on a thumb drive (or just review it) — the easy way

You have two ways to look at the work. **No compiler is needed for either.**

> Quick note on what I (Claude) can and can't do: I build, test, and verify the
> code in the cloud, but I can't reach into your computer to write your USB stick
> or open your browser. So the **last step runs on your machine** — I've made it
> one command. Everything below is copy‑paste.

---

## Option 1 — Review it right now on your computer (fastest, any OS, no USB)

You need **Node.js 20+** once (free, from nodejs.org). Then, in a terminal,
inside the project folder:

```
npm ci
npm run next:build
node desktop/scripts/launch.mjs
```

A browser tab opens at the Workshop (`/builder`). Explore everything:

- The website/app builder, then the **Studio** button → the tool hub at `/tools`.
- **Software Creation** (`/tools/software`) — drag feature cards, build, export.
- **Embroidery Studio** (`/tools/embroidery`) — paint/auto‑digitize, stamp
  Armenian/any‑font text, export a chart, PNG, and a DST/EXP machine file.

To stop: go back to the terminal and press **Ctrl+C**. Nothing is installed
system‑wide; nothing phones home.

---

## Option 2 — Make the real thumb drive (Windows)

This produces a self‑contained USB stick that runs by double‑clicking — no
install, fully offline.

### The one‑click way
1. Plug in your USB stick (note its letter, e.g. `E:`).
2. In the project folder, **double‑click `make-drive.bat`**.
3. When it asks, type the drive folder, e.g. `E:\Workshop`, and press Enter.
4. Wait (a few minutes — it copies the app + a private Node runtime).
5. Open the USB stick and **double‑click `start.bat`**. The Workshop opens.

### The same thing as three commands (if you prefer the terminal)
```
npm ci
npm run next:build
node desktop\scripts\make-portable.mjs E:\Workshop
```
Then open `E:\Workshop` and double‑click **`start.bat`**.

That's it. The drive contains everything: a private Node runtime, the built app,
and your data folders. (A fancier `baghdos-workshop.exe` launcher is *optional* —
it needs a one‑time Windows build; `start.bat` does the same job without it.)

---

## Option 3 — Raspberry Pi 5 (later)

Assemble **on the Pi** (so the native bits match arm64), then run `./start.sh`:
```
npm ci && npm run next:build
node desktop/scripts/make-portable.mjs /media/USB --target linux-arm64
```

---

## Good to know

- **100% offline.** Once the drive is assembled, nothing needs the internet.
  (The *assembly* step downloads the portable Node runtime once — it's
  checksum‑verified before use.)
- **Your data stays local** — it lives in the drive's `portable/` folder as
  plain files you can back up.
- **Optional extras** (only if you want them): Media Studio video tools, the
  Retro Game Room, and the Communication Coach voice feature each need a small
  one‑time helper download — see `docs/PORTABLE_LAYOUT.md`. The core builder and
  all the offline tools work without any of them.
- **Refresh just the launcher** on an existing drive (no full recopy):
  `node desktop/scripts/make-portable.mjs E:\Workshop --scaffold-only`.

Everything is on the branch `claude/codebase-review-w50a0a`.
