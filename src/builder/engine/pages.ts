// ============================================================
// Builder engine — page & template operations (Phase 6)
// ============================================================
// Create / duplicate / rename live here as pure functions; the
// shell wires them to the document API. Document paths derive
// from slugs, so rename-with-slug-change = write new + delete
// old (the shell owns that two-step; these helpers just produce
// correct documents).
// ============================================================

import type { Block } from "../schema/block.ts";
import { newId } from "../schema/block.ts";
import { SLUG_RE, type Page, type Template } from "../schema/documents.ts";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate.ts";
import { cloneWithFreshIds, EngineError } from "./tree.ts";

/** "Gift Guide 2026!" → "gift-guide-2026" */
export function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function pagePath(slug: string): string {
  return `builder/pages/${slug}.json`;
}

export function templatePath(name: string): string {
  return `builder/templates/${suggestSlug(name) || "template"}.json`;
}

export interface NewPageOptions {
  title: string;
  slug?: string;
  kind?: Page["kind"];
  /** Start from a template's sections (deep-cloned, fresh ids). */
  template?: Template;
}

export function createPage(opts: NewPageOptions): Page {
  const slug = opts.slug ?? suggestSlug(opts.title);
  if (!SLUG_RE.test(slug)) {
    throw new EngineError("bad_slug", `"${slug}" isn't a valid slug (lowercase-kebab-case)`);
  }
  let sections: Block[] = [];
  let kind: Page["kind"] = opts.kind ?? "standard";

  if (opts.template) {
    if ("sections" in (opts.template.root as Record<string, unknown>)) {
      const root = opts.template.root as Page;
      sections = root.sections.map(cloneWithFreshIds);
      kind = opts.kind ?? root.kind;
    } else {
      sections = [cloneWithFreshIds(opts.template.root as Block)];
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: newId("b"),
    slug,
    kind,
    title: opts.title,
    order: 0,
    seo: {},
    sections,
    status: "draft",
  };
}

/** Deep copy with a fresh page id, fresh block ids, new title/slug, back to draft. */
export function duplicatePage(page: Page, title: string, slug?: string): Page {
  const nextSlug = slug ?? suggestSlug(title);
  if (!SLUG_RE.test(nextSlug)) {
    throw new EngineError("bad_slug", `"${nextSlug}" isn't a valid slug`);
  }
  if (nextSlug === page.slug) {
    throw new EngineError("slug_taken", "The copy needs a different slug than the original");
  }
  return {
    ...structuredClone(page),
    id: newId("b"),
    title,
    slug: nextSlug,
    status: "draft",
    publishedHash: undefined,
    sections: page.sections.map(cloneWithFreshIds),
  };
}

/** Capture a page as a reusable page template. */
export function pageToTemplate(page: Page, name: string): Template {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: newId("tpl"),
    name,
    kind: "page",
    root: {
      ...structuredClone(page),
      id: newId("b"),
      status: "draft",
      publishedHash: undefined,
    },
  };
}
