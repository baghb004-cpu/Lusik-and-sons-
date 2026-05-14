// ============================================================
// Tailwind PostCSS configuration
// ============================================================
// Replaces the runtime CDN (https://cdn.tailwindcss.com) that
// index.html currently loads in <head>. PostCSS Tailwind only
// emits classes it can statically see in the `content` files,
// so this config gets pointed at both index.html (for now) and
// the eventual src/**/* tree (post-migration).
//
// IMPORTANT GOTCHA — dynamic class names:
// PostCSS Tailwind statically scans for class strings. Anything
// like `` `bg-${color}` `` is invisible to the scanner and will
// be silently dropped from the build. During the migration,
// grep for template-literal classes:
//
//   rg '\\\`[^\\\`]*\\\$\\{[^}]*\\}[^\\\`]*\\\`' index.html src/
//
// Each match needs either:
//   (a) refactor to inline `style={{ background: color }}` (the
//       DMC palette is arbitrary hex, so this is usually cleaner)
//   (b) add the dynamic class set to `safelist` below.
// ============================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Match the Google Fonts pulled in <head>. Listed in the
        // same order so the CSS variable cascades match too.
        display: ['"Fraunces"', "Georgia", "serif"],
        body:    ['"DM Sans"', "system-ui", "-apple-system", "sans-serif"],
        script:  ['"Allura"', "cursive"],
      },
      colors: {
        // Brand palette mirrored from index.html's CSS custom
        // properties. Keep these names stable — utility classes
        // like `bg-cream` are referenced throughout the JSX.
        ink:    "#1A1612",
        cream:  "#F5EFE3",
        accent: "#B08842",
        muted:  "#6B655D",
      },
    },
  },
  plugins: [],
};
