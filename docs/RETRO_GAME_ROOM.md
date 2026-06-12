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
