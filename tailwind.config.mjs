// ============================================================
// Tailwind PostCSS configuration
// ============================================================
// PostCSS Tailwind only emits classes it can statically see in
// the `content` files, so this config is pointed at the whole
// app/ + src/ tree.
//
// IMPORTANT GOTCHA — dynamic class names:
// PostCSS Tailwind statically scans for class strings. Anything
// like `` `bg-${color}` `` is invisible to the scanner and will
// be silently dropped from the build. Grep for template-literal
// classes:
//
//   rg '\\\`[^\\\`]*\\\$\\{[^}]*\\}[^\\\`]*\\\`' app/ src/
//
// Each match needs either:
//   (a) refactor to inline `style={{ background: color }}` (the
//       DMC palette is arbitrary hex, so this is usually cleaner)
//   (b) add the dynamic class set to `safelist` below.
// ============================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
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
        // Brand palette mirrored from the stylesheet's CSS custom
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
