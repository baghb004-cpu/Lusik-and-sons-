// ============================================================
// SEO Optimizer — page fact extraction (pure, dependency-free)
// ============================================================
// The "scanner": reads ONE exported HTML string (plus, optionally,
// on-disk sizes of the files it references) and pulls every signal
// the Lighthouse-inspired ruleset needs. Regex-based on purpose —
// no HTML-parser dependency, so this runs from a thumb drive with
// nothing installed but Node. It extracts SIGNALS, not a DOM; the
// rules in rules.ts turn signals into scores + fixes.
//
// 100% offline: it only ever reads files the user already exported.
// ============================================================

export interface ImgFact {
  src: string;
  hasAlt: boolean;
  altEmpty: boolean;
  hasDimensions: boolean; // width AND height present
  lazy: boolean;
  bytes?: number;
}

export interface LinkFact {
  href: string;
  text: string;
  external: boolean;
}

export interface PageFacts {
  file: string;
  htmlBytes: number;
  lang: string | null;
  title: string | null;
  titleLen: number;
  metaDescription: string | null;
  metaDescriptionLen: number;
  hasViewport: boolean;
  hasCharset: boolean;
  canonical: string | null;
  robotsNoindex: boolean;
  h1Count: number;
  headings: number[]; // levels in document order, e.g. [1,2,2,3]
  images: ImgFact[];
  links: LinkFact[];
  hasJsonLd: boolean;
  ogTitle: boolean;
  ogImage: boolean;
  scripts: { src: string | null; inlineBytes: number; async: boolean; defer: boolean }[];
  stylesheets: { href: string; bytes?: number }[];
  /** Sum of HTML + referenced CSS/JS/img bytes we could resolve. */
  totalBytes: number;
  /** Largest single image in bytes (LCP candidate proxy). */
  largestImageBytes: number;
}

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
};
const has = (tag: string, name: string): boolean => new RegExp(`(^|\\s)${name}(\\s|=|>|$)`, "i").test(tag);
const tagsOf = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];

export interface SizeLookup {
  (relPath: string): number | undefined;
}

export function extractFacts(file: string, html: string, sizeOf: SizeLookup = () => undefined): PageFacts {
  const head = (html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html);
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const titleText = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;

  // Scan the head's <meta> and <link> tags ONCE, then read every signal off
  // the cached lists (was re-running the regex per signal).
  const headMetas = tagsOf(head, "meta");
  const headLinks = tagsOf(head, "link");

  const metaDesc = (() => {
    for (const t of headMetas) {
      if ((attr(t, "name") ?? "").toLowerCase() === "description") return (attr(t, "content") ?? "").trim();
    }
    return null;
  })();

  const robots = headMetas.some(
    (t) => (attr(t, "name") ?? "").toLowerCase() === "robots" && /noindex/i.test(attr(t, "content") ?? "")
  );

  const canonical = (() => {
    for (const t of headLinks) if ((attr(t, "rel") ?? "").toLowerCase() === "canonical") return attr(t, "href");
    return null;
  })();

  const headings: number[] = [];
  for (const m of html.matchAll(/<h([1-6])\b/gi)) headings.push(Number(m[1]));

  const images: ImgFact[] = tagsOf(html, "img").map((t) => {
    const src = attr(t, "src") ?? "";
    const altRaw = attr(t, "alt");
    const bytes = sizeOf(src);
    return {
      src,
      hasAlt: altRaw !== null,
      altEmpty: altRaw === "",
      hasDimensions: has(t, "width") && has(t, "height"),
      lazy: (attr(t, "loading") ?? "").toLowerCase() === "lazy",
      bytes,
    };
  });

  const links: LinkFact[] = (html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) ?? []).map((block) => {
    const open = block.match(/<a\b[^>]*>/i)?.[0] ?? "";
    const href = attr(open, "href") ?? "";
    const text = block.replace(/<a\b[^>]*>/i, "").replace(/<\/a>/i, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const ariaLabel = attr(open, "aria-label");
    return { href, text: text || ariaLabel || "", external: /^https?:\/\//i.test(href) };
  });

  const scripts = (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) ?? []).map((block) => {
    const open = block.match(/<script\b[^>]*>/i)?.[0] ?? "";
    const src = attr(open, "src");
    const inline = block.replace(/<script\b[^>]*>/i, "").replace(/<\/script>/i, "");
    return { src, inlineBytes: src ? 0 : Buffer.byteLength(inline, "utf8"), async: has(open, "async"), defer: has(open, "defer") };
  });

  const stylesheets = headLinks
    .filter((t) => (attr(t, "rel") ?? "").toLowerCase() === "stylesheet")
    .map((t) => {
      const href = attr(t, "href") ?? "";
      return { href, bytes: sizeOf(href) };
    });

  const htmlBytes = Buffer.byteLength(html, "utf8");
  const imgBytes = images.reduce((s, i) => s + (i.bytes ?? 0), 0);
  const cssBytes = stylesheets.reduce((s, c) => s + (c.bytes ?? 0), 0);
  const jsBytes = scripts.reduce((s, j) => s + (j.src ? sizeOf(j.src) ?? 0 : j.inlineBytes), 0);

  return {
    file,
    htmlBytes,
    lang: attr(htmlTag, "lang"),
    title: titleText,
    titleLen: titleText?.length ?? 0,
    metaDescription: metaDesc,
    metaDescriptionLen: metaDesc?.length ?? 0,
    hasViewport: headMetas.some((t) => (attr(t, "name") ?? "").toLowerCase() === "viewport"),
    hasCharset: headMetas.some((t) => has(t, "charset")),
    canonical,
    robotsNoindex: robots,
    h1Count: headings.filter((h) => h === 1).length,
    headings,
    images,
    links,
    hasJsonLd: /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i.test(html),
    ogTitle: headMetas.some((t) => (attr(t, "property") ?? "").toLowerCase() === "og:title"),
    ogImage: headMetas.some((t) => (attr(t, "property") ?? "").toLowerCase() === "og:image"),
    scripts,
    stylesheets,
    totalBytes: htmlBytes + imgBytes + cssBytes + jsBytes,
    largestImageBytes: images.reduce((m, i) => Math.max(m, i.bytes ?? 0), 0),
  };
}
