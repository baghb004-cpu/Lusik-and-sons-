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
    // Default Tailwind scale + the 700px "book" tier between sm and md —
    // the open-book canvas (iPhone Fold inner display, iPad mini portrait,
    // big landscape phones). Declared in FULL so the cascade order stays
    // sm < book < md < lg and a book: utility can never out-cascade md:.
    screens: {
      sm: "640px",
      book: "700px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        // Point at the tokens in index.css rather than repeating the
        // stacks. They are the only place the Armenian faces are named,
        // and a second copy here is how one of them goes stale.
        display: ["var(--font-display)"],
        body:    ["var(--font-body)"],
        script:  ["var(--font-script)"],
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
