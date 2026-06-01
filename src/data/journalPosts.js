// ============================================================
// JOURNAL_POSTS — re-exported from generated data
// ============================================================
// The post list is built at COMPILE time from the markdown files in
// `src/data/journal-posts/*.md` by `scripts/gen-journal-posts.mjs`,
// which writes `journalPostsData.js`. This module just re-exports it
// so every importer's path (`../data/journalPosts.js`) stays stable.
//
// Why the codegen instead of the old `import.meta.glob`: that loader
// was Vite-only and unsupported by Next/webpack (it warned "Accessing
// import.meta directly is unsupported" and returned undefined at
// runtime). The generated data module is plain JS, so it works in
// BOTH builds during the Vite→Next migration — and in server
// components (Phase 7) — with identical output.
//
// The generator runs as a prebuild step (predev / prebuild /
// prenext:build), so editing an .md file (or saving via Decap at
// /admin/) is reflected on the next deploy exactly as before. The
// committed journalPostsData.js is the dev/typecheck snapshot.
//
// Content nodes: each post's markdown body is parsed into typed nodes
// ({ type: "h2"|"blockquote"|"p", text }) that JournalPostView renders.
//
// SITEMAP NOTE: when you add or remove a post, run `npm run gen:sitemap` to
// regenerate public/sitemap.xml — every post needs a <url> entry for Google
// to index it. Don't change a slug once a post is shared.
// ============================================================

export { JOURNAL_POSTS } from "./journalPostsData.js";
