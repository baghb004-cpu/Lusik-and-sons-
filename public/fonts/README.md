# Offline fonts

Drop the bundled web fonts here so Armenian/Arabic/Cyrillic/Latin render
identically everywhere **without calling the internet**. Expected files
(referenced by `src/builder/i18n/fonts.ts`):

| File | Covers | Source (redistributable, OFL) |
| --- | --- | --- |
| `latin.woff2` | English, Spanish | Noto Sans |
| `armenian.woff2` | Armenian | Noto Sans Armenian |
| `arabic.woff2` | Arabic | Noto Sans Arabic |
| `cyrillic.woff2` | Russian | Noto Sans (Cyrillic subset) |

**You don't strictly need these to go offline** — every locale also lists
OS-font fallbacks, so text renders on any modern device even with this
folder empty. The bundled woff2 only guarantee the *same* look everywhere.

Fetch them once with `node scripts/fetch-fonts.mjs` (needs internet that
one time), or download Noto subsets yourself and rename to the files above.
All four are licensed under the SIL Open Font License — free to bundle and
redistribute.
