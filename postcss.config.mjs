// PostCSS pipeline for the Next.js build: Tailwind first, then
// autoprefixer for vendor-prefix coverage. No other plugins —
// the simpler the pipeline, the less can break.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
