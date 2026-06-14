# The Retro Game Room — what it is and what it is not

A private, local-only den inside the Workshop's portable environment
where the family can launch **their own legally owned** Windows
95/98/2000/XP-era PC games (the SpongeBob discs, Disney Learning, Rayman,
Reader Rabbit, Math Rabbit, and friends) through open-source emulation.

## The rules this module is built on

- **It is OFF by default.** Enable it locally: `portable/settings.json`
  → `gameRoom.enabled: true`. It is never served from a hosted site and
  never included in exported websites or apps.
- **You supply the media.** ISO files you created from discs you own,
  or the disc itself in a drive. The Room stores *paths and settings* —
  it never downloads, bundles, or scrapes games, OS images, BIOSes,
  serial keys, cover art, or anything copyrighted.
- **You install the backends.** DOSBox-X, 86Box and QEMU are free,
  open-source, and one download each — they go in
  `portable/retro/emulators/`. Windows-era VMs are built from YOUR own
  install media inside those tools.
- **No DRM circumvention.** The Room launches what runs; it does not
  crack, patch, or bypass anything.

## What it does for you

- A library that **remembers**: add an ISO once and it lives on the
  shelf forever; if the file moves, the entry shows "Locate File Again"
  instead of dying.
- **Optional import**: copy an ISO into `portable/retro/user-media/isos`
  (size shown first, explicit confirm) so the whole room travels on the
  thumb drive.
- **Era profiles** (Win95/98/2000/XP/DOS) defining backend, RAM, and an
  honest **save tier** per setup: DOSBox-X save-states → QEMU qcow2
  snapshots → plain disk-state → in-game saves only. The shelf shows
  which one each game really has.
- **Warn-before-run**: launching first shows the exact command that
  will execute; nothing runs until you confirm.
- **Brand-neutral controllers**: detection and a test screen in Game
  Mode, per-game mapping profiles (buttons → keys/mouse), generated
  DOSBox-X mapper files; VM-era games configure input inside the VM
  (stated plainly, not hidden).
- **Quick Save + backup**: launcher state quick-saves locally;
  `backups/` zips cover settings/profiles/library metadata (ISOs and VM
  images are excluded by design — the response says so — copy those big
  folders by hand).

## The least-tinkering path (what §23b added)

1. Open the room → **Setup wizard** (works even while the room is off):
   every row is Ready / Missing / Optional with a real **Fix This**
   button where the engine can act (enable the room, create folders,
   seed the Win95/98/XP era profiles + a starter controller mapping).
2. `node scripts/install-retro-tools.mjs` — downloads the official
   open-source backends with the GPL-2.0 obligations handled
   automatically (license note + source list written beside the
   binaries). **The honest bundling answer: GPL-2.0 allows
   redistributing these binaries on your drive**, provided the license
   text rides along and the source stays available — which the script
   does. It never touches Windows images, BIOS/ROM files, games or keys.
3. **Adopt a LEGO template**: six ready-made launch profiles
   (LEGO Island, LEGO Island 2, LEGOLAND, LEGO Racers, LEGO Racers 2,
   LEGO Rock Raiders) carry every setting — backend, RAM, graphics/
   audio/save/compat notes. You supply only the disc or your own ISO,
   and the entry lands on the shelf permanently. QEMU is the
   recommended default for all six: it ships the open-source SeaBIOS,
   so there is no BIOS hunting at all.
4. `node scripts/preflight-portable.mjs` — the one-look status table
   for the whole flash drive (launcher, Godot, backends, media, saves,
   privacy). `desktop/scripts/build-windows.ps1` scripts the single
   Windows session end to end.

Paths inside `portable/` stay relative, so the drive can change letters
freely; absolute paths get a gentle "consider Import ISO" warning.
