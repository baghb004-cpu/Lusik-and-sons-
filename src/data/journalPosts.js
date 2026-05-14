// ============================================================
// JOURNAL_POSTS — loaded from markdown files in journal-posts/
// ============================================================
// Previously a hand-edited JS array; now built at compile time
// from `src/data/journal-posts/*.md`. Each post is an `.md`
// file with YAML front-matter (between --- markers) plus a
// markdown body. Decap CMS (mounted at /admin/) edits these
// files directly — Lusik can write a new post in a browser,
// hit Save, and Decap commits to GitHub, which triggers a
// Netlify deploy, which builds + ships the new post.
//
// The build-time loader pattern: Vite's import.meta.glob
// statically walks the journal-posts/ directory and inlines
// every file as a string (`?raw`). At runtime we parse each
// for front-matter + content, sort by publishedAt, and export
// the same shape JOURNAL_POSTS used to have so no downstream
// component needs to change.
//
// Content nodes: the markdown body becomes an array of typed
// nodes — { type: "h2", text } for `## headings` and
// { type: "p", text } for paragraphs. That keeps the
// JournalPostView rendering logic identical to before.
//
// MIRRORED INTENT FROM the previous inline definition (pre-Phase 2).
// Adding a new post: use Decap at /admin/, OR drop a new file
// in src/data/journal-posts/ with the matching front-matter
// shape (slug / title / excerpt / publishedAt / readMinutes).
// Don't change a slug once a post is shared.
//
// SITEMAP NOTE: when you add or remove a post, update
// sitemap.xml at the repo root — every post needs a <url>
// entry for Google to index it.
// ============================================================

// `?raw` tells Vite to load each .md file as a plain string.
// `eager: true` resolves them at build time so no async cost
// at the call site.
const rawPosts = import.meta.glob("./journal-posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Parse `key: value` lines between --- markers at the top of
// the file. Values are unquoted unless they start with " — we
// strip surrounding quotes on those, leave bare values as
// strings. publishedAt + readMinutes get coerced numerically.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    // Strip surrounding double-quotes if present.
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  // Coerce known numeric fields.
  if (meta.readMinutes) meta.readMinutes = Number(meta.readMinutes);
  return { meta, body: m[2] };
}

// Convert the markdown body to the typed-node array the
// JournalPostView component already knows how to render.
// Supports: ## heading → h2, > blockquote → blockquote,
// plain paragraph → p. No bold/italic/links — the existing
// posts don't use those, and richer markdown would invite
// runtime parsing complexity we don't need yet.
function bodyToNodes(body) {
  const nodes = [];
  const paragraphs = body.trim().split(/\n\s*\n/);
  for (const para of paragraphs) {
    const t = para.trim();
    if (!t) continue;
    if (t.startsWith("## ")) {
      nodes.push({ type: "h2", text: t.slice(3).trim() });
    } else if (t.startsWith("> ")) {
      nodes.push({ type: "blockquote", text: t.slice(2).trim() });
    } else {
      // Join multi-line paragraphs into a single text node.
      nodes.push({ type: "p", text: t.replace(/\n/g, " ") });
    }
  }
  return nodes;
}

const parsed = Object.values(rawPosts).map((raw) => {
  const { meta, body } = parseFrontmatter(raw);
  return {
    slug:        meta.slug ?? "",
    title:       meta.title ?? "",
    excerpt:     meta.excerpt ?? "",
    publishedAt: meta.publishedAt ?? "",
    readMinutes: meta.readMinutes ?? 3,
    content:     bodyToNodes(body),
  };
});

// Sort newest-first (lexicographic ISO date sort works here).
parsed.sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));

export const JOURNAL_POSTS = parsed;
