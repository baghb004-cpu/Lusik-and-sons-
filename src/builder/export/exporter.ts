// ============================================================
// Export orchestrator (Phase 11) — fs-mode, local-first
// ============================================================
// Reads builder documents through the storage layer, renders
// each page through the REAL renderer, and writes a complete
// export to exports/<stamp>-<target>/.
//
//   static: per-page index.html (zero JS) + styles.css compiled
//           programmatically by Tailwind against the EMITTED
//           HTML (raw-content mode) with the site's theme tokens
//           — so the utility classes the renderer used are the
//           only CSS shipped. Override layers ride as @media
//           rules; mobile-only blocks are materialized markup.
//   next:   a runnable Next.js scaffold + the renderer packages
//           copied in (schema/engine/renderer/theme) + the
//           builder documents + a catalog snapshot. The Lusik
//           site remains the reference implementation; this
//           scaffold is its minimal sibling.
//
// Local-first by design (plan §11): exports run where the files
// live — dev server, home server, thumb drive. Hosted (github
// storage) export lands with Phase 12's download flow.
// ============================================================

import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { pageSchema, overrideLayerSchema, themeSchema, migrateDocument, type OverrideLayer, type Page, type Theme } from "../schema/index.ts";
import { validatePage, validateCommerceRefs, type CatalogSnapshot } from "../engine/index.ts";
import { materializeMobileOnly } from "../engine/overrides.ts";
import { overridePath } from "../engine/index.ts";
import type { BuilderStorage } from "../storage/index.ts";
import { renderPageBody } from "./render.tsx";
import { assembleHtmlDocument, pageFileName } from "./static.ts";
import { buildManifest } from "./manifest.ts";

export interface ExportInput {
  storage: BuilderStorage;
  // pwa = static + manifest/sw/icons; swiftui = native iOS scaffold (App
  // Developer Mode's native path — compiles on a Mac).
  target: "static" | "next" | "pwa" | "swiftui";
  outDir: string; // absolute
  catalog: CatalogSnapshot;
  cms?: { featured?: string };
  siteName?: string;
  /** SwiftUI commerce links point back here (the live web shop). */
  webBaseURL?: string;
}

export interface ExportResult {
  outDir: string;
  files: string[];
  pages: number;
  skipped: Array<{ path: string; reason: string }>;
}

async function loadPages(storage: BuilderStorage, catalog: CatalogSnapshot) {
  const pages: Array<{ page: Page; layers: OverrideLayer[] }> = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  for (const path of await storage.list("builder/pages")) {
    const raw = await storage.read(path);
    if (!raw) continue;
    const result = validatePage(JSON.parse(raw));
    if (!result.page || !result.publishable) {
      skipped.push({ path, reason: "fails the publish gate" });
      continue;
    }
    const commerce = validateCommerceRefs(result.page.sections, catalog).filter((i) => i.level === "error");
    if (commerce.length > 0) {
      skipped.push({ path, reason: commerce[0].message });
      continue;
    }
    const layers: OverrideLayer[] = [];
    for (const bp of ["tablet", "mobile"] as const) {
      const layerRaw = await storage.read(overridePath(result.page.slug, bp)).catch(() => null);
      if (layerRaw) {
        const parsed = overrideLayerSchema.safeParse(migrateDocument(JSON.parse(layerRaw)));
        if (parsed.success) layers.push(parsed.data);
      }
    }
    pages.push({ page: result.page, layers });
  }
  return { pages, skipped };
}

async function loadTheme(storage: BuilderStorage): Promise<Theme | null> {
  const raw = await storage.read("builder/theme.json").catch(() => null);
  if (!raw) return null;
  const parsed = themeSchema.safeParse(migrateDocument(JSON.parse(raw)));
  return parsed.success ? parsed.data : null;
}

async function loadI18n(storage: BuilderStorage) {
  const { i18nSettingsSchema, DEFAULT_I18N_SETTINGS } = await import("../i18n/index.ts");
  const raw = await storage.read("builder/i18n.json").catch(() => null);
  if (!raw) return DEFAULT_I18N_SETTINGS;
  const parsed = i18nSettingsSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : DEFAULT_I18N_SETTINGS;
}

/** Compile the utility-CSS subset the emitted HTML actually uses.
 *  `colorOverrides` (appearance-enabled exports) swaps the brand palette
 *  to rgb(var(--bt-rgb-*)) channels so dark mode's variable flip re-skins
 *  every utility — bg-cream, text-ink, bg-white/60, alpha variants, all
 *  of it — with zero extra classes in the markup. */
async function compileCss(htmlDocs: string[], colorOverrides?: Record<string, string>): Promise<string> {
  const [{ default: postcss }, { default: tailwindcss }] = await Promise.all([
    import("postcss"),
    import("tailwindcss"),
  ]);
  const site = (await import("../../../tailwind.config.mjs")).default as {
    theme: { extend?: { colors?: Record<string, string> } } & Record<string, unknown>;
  };
  const theme = colorOverrides
    ? { ...site.theme, extend: { ...site.theme.extend, colors: { ...site.theme.extend?.colors, ...colorOverrides } } }
    : site.theme;
  const result = await postcss([
    tailwindcss({
      content: htmlDocs.map((raw) => ({ raw, extension: "html" })),
      theme,
      corePlugins: { preflight: true },
    } as never),
  ]).process("@tailwind base;\n@tailwind components;\n@tailwind utilities;", { from: undefined });
  return result.css;
}

export async function runExport(input: ExportInput): Promise<ExportResult> {
  const siteName = input.siteName ?? "Site";
  const { pages, skipped } = await loadPages(input.storage, input.catalog);
  const theme = await loadTheme(input.storage);
  const glass = theme?.tokens.glass ?? [];
  const written: string[] = [];
  const fileContents: Array<{ path: string; content: string }> = [];

  const write = async (rel: string, content: string) => {
    const abs = join(input.outDir, rel);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, content, "utf8");
    written.push(rel);
    fileContents.push({ path: rel, content });
  };

  if (input.target === "static" || input.target === "pwa") {
    const pwa = input.target === "pwa";
    // Offline languages: render every page once PER ENABLED LOCALE into a
    // locale-prefixed path (default at root, others under /<code>/). The
    // switcher/gate link between them — zero-JS, real per-language URLs,
    // fully offline.
    const { localizeBlocks, localeByCode, buildI18nCss, isRtl } = await import("../i18n/index.ts");
    const i18n = await loadI18n(input.storage);
    const localeList = i18n.locales.map((code) => ({ code, endonym: localeByCode(code)?.endonym ?? code }));

    // hrefForLocale maps a page across locale prefixes (root-absolute).
    const pagePathFor = (locale: string, slug: string) => {
      const prefix = locale === i18n.defaultLocale ? "" : `/${locale}`;
      return slug === "index" ? `${prefix}/` : `${prefix}/${slug}/`;
    };
    const outFileFor = (locale: string, slug: string) => {
      const prefix = locale === i18n.defaultLocale ? "" : `${locale}/`;
      return slug === "index" ? `${prefix}index.html` : `${prefix}${slug}/index.html`;
    };

    // Day/Night/Candlelight (plan §19): when the theme enables appearance,
    // compile its CSS once, build the anti-flash bootstrap, and swap the
    // Tailwind palette to variable channels.
    const appearanceOn = !!theme?.appearance?.enabled;
    const candle = theme?.appearance?.candlelight;
    const appearanceForPage = appearanceOn && theme
      ? await (async () => {
          const { appearanceCss } = await import("../theme/appearance.ts");
          const { appearanceBootstrap } = await import("../renderer/appearanceScript.ts");
          return { css: appearanceCss(theme), bootstrap: appearanceBootstrap(candle) };
        })()
      : undefined;

    const rendered: Array<{ slug: string; outFile: string; locale: string; layers: OverrideLayer[]; page: Page; bodyHtml: string }> = [];
    for (const locale of i18n.locales) {
      for (const { page, layers } of pages) {
        const mobileLayer = layers.find((l) => l.breakpoint === "mobile");
        const base = mobileLayer ? materializeMobileOnly(page.sections, mobileLayer) : page.sections;
        const sections = localizeBlocks(base, locale, i18n.defaultLocale);
        const bodyHtml = await renderPageBody({
          blocks: sections,
          catalog: input.catalog,
          glass,
          cms: input.cms,
          candle,
          i18n: { locales: localeList, current: locale, hrefForLocale: (c) => pagePathFor(c, page.slug) },
        });
        rendered.push({ slug: page.slug, outFile: outFileFor(locale, page.slug), locale, layers, page, bodyHtml });
      }
    }
    const colorOverrides = appearanceOn && theme
      ? (await import("../theme/appearance.ts")).appearanceTailwindColors(theme)
      : undefined;
    const css = await compileCss(rendered.map((r) => r.bodyHtml), colorOverrides);
    await write("styles.css", css);
    if (i18n.locales.length > 1 || i18n.locales[0] !== "en") {
      await write("i18n.css", buildI18nCss(i18n.locales));
    }
    const i18nActive = i18n.locales.length > 1 || i18n.locales[0] !== "en";
    for (const r of rendered) {
      const depth = r.outFile.split("/").length - 1; // dir nesting → "../" count
      const loc = localeByCode(r.locale);
      const html = assembleHtmlDocument({
        page: r.page,
        bodyHtml: r.bodyHtml,
        layers: r.layers,
        theme,
        stylesheetHref: `${"../".repeat(depth)}styles.css`,
        siteName,
        pwa,
        lang: r.locale,
        dir: loc?.dir ?? (isRtl(r.locale) ? "rtl" : "ltr"),
        i18nHref: i18nActive ? `${"../".repeat(depth)}i18n.css` : undefined,
        appearance: appearanceForPage,
      });
      await write(r.outFile, html);
    }
    if (pwa) {
      const { buildWebManifest, buildServiceWorker, buildPwaReadme } = await import("../app/pwa.ts");
      await write("manifest.webmanifest", buildWebManifest({ name: siteName, theme }));
      await write("sw.js", buildServiceWorker(new Date().toISOString().slice(0, 10)));
      await write("README-PWA.md", buildPwaReadme(siteName));
      await write("icons/README.txt", "Replace icon-192.png, icon-512.png and icon-maskable-512.png with real PNG artwork (same filenames).\n");
    } else {
      await write("README-DEPLOY.md", staticReadme(siteName, pages.length));
    }
  } else if (input.target === "swiftui") {
    // Native iOS scaffold — pure codegen here; compiles on a Mac (Xcode).
    // Localize to the default language (v1 native export is single-locale).
    const { buildSwiftUIProject } = await import("./swiftui.ts");
    const { localizeBlocks } = await import("../i18n/index.ts");
    const i18n = await loadI18n(input.storage);
    const localizedPages = pages.map((p) => ({ ...p.page, sections: localizeBlocks(p.page.sections, i18n.defaultLocale, i18n.defaultLocale) }));
    const project = buildSwiftUIProject(
      localizedPages,
      theme,
      siteName,
      input.webBaseURL ?? "https://example.com"
    );
    for (const [rel, content] of Object.entries(project)) await write(rel, content);
  } else {
    // next: scaffold + renderer packages + documents + catalog snapshot.
    for (const [rel, content] of Object.entries(nextScaffold(siteName))) {
      await write(rel, content);
    }
    await write("data/catalog.json", JSON.stringify(input.catalog, null, 2));
    await write("data/cms.json", JSON.stringify(input.cms ?? {}, null, 2));
    // Copy documents + the renderer-side builder packages verbatim.
    const root = process.cwd();
    await cp(join(root, "builder"), join(input.outDir, "builder"), { recursive: true });
    for (const pkg of ["schema", "engine", "renderer", "theme"]) {
      await cp(join(root, "src", "builder", pkg), join(input.outDir, "src", "builder", pkg), { recursive: true });
    }
    written.push("builder/**", "src/builder/{schema,engine,renderer,theme}/**");
  }

  // Phase 17: the chosen services decorate every export with their
  // step-by-step setup checklist.
  try {
    const servicesRaw = await input.storage.read("builder/data/services.json");
    if (servicesRaw) {
      const { servicesSelectionSchema, checklistMarkdown } = await import("../presets/selection.ts");
      const services = servicesSelectionSchema.safeParse(JSON.parse(servicesRaw));
      if (services.success && services.data.selection.length > 0) {
        await write("SETUP-CHECKLIST.md", checklistMarkdown(services.data.selection, services.data.stack));
      }
    }
  } catch { /* no services doc — exports ship without a checklist */ }

  const manifest = buildManifest(input.target, pages.map((p) => p.page), fileContents);
  await writeFile(join(input.outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  written.push("manifest.json");

  return { outDir: input.outDir, files: written, pages: pages.length, skipped };
}

function staticReadme(siteName: string, pages: number): string {
  return `# ${siteName} — static export

${pages} page(s), zero JavaScript. Deploy by uploading this folder to any
static host (Netlify Drop, Cloudflare Pages, GitHub Pages, an S3 bucket,
or plain nginx). styles.css carries the design system; each page is a
self-contained index.html under its slug.

Interactive pieces (accordions, drawers, tabs) are native HTML/CSS and
work without scripts. Commerce blocks link to the canonical product
pages — checkout itself is not part of a static export.
`;
}

function nextScaffold(siteName: string): Record<string, string> {
  return {
    "package.json": JSON.stringify(
      {
        name: "builder-export",
        private: true,
        type: "module",
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "^15.0.0", react: "^18.3.1", "react-dom": "^18.3.1", zod: "^4.0.0" },
        devDependencies: { autoprefixer: "^10.4.0", postcss: "^8.4.0", tailwindcss: "^3.4.0", typescript: "^5.6.0", "@types/react": "^18.3.0", "@types/node": "^22.0.0" },
      },
      null,
      2
    ),
    "next.config.mjs": "export default {};\n",
    "postcss.config.mjs": "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n",
    "tailwind.config.mjs": `export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#1A1612", cream: "#F5EFE3", accent: "#B08842", muted: "#6B655D" },
      fontFamily: { display: ["Fraunces", "Georgia", "serif"], body: ["DM Sans", "system-ui", "sans-serif"] },
    },
  },
};\n`,
    "tsconfig.json": JSON.stringify(
      { compilerOptions: { target: "ES2020", lib: ["ES2020", "DOM"], module: "ESNext", moduleResolution: "bundler", jsx: "preserve", strict: true, allowImportingTsExtensions: true, noEmit: true, esModuleInterop: true, isolatedModules: true, plugins: [{ name: "next" }] }, include: ["app/**/*", "src/**/*"] },
      null,
      2
    ),
    "app/globals.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    "app/layout.tsx": `import "./globals.css";
export const metadata = { title: ${JSON.stringify(siteName)} };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body className="bg-cream font-body text-ink">{children}</body></html>
  );
}
`,
    "app/[[...slug]]/page.tsx": `// Every builder page, rendered through the same block renderer the
// editor used. Pages are static at build time (generateStaticParams).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { BlockRenderer } from "../../src/builder/renderer/index.ts";
import { pageSchema, themeSchema, migrateDocument } from "../../src/builder/schema/index.ts";
import { themeToCssVars } from "../../src/builder/theme/css.ts";

const ROOT = process.cwd();
const catalog = JSON.parse(readFileSync(join(ROOT, "data/catalog.json"), "utf8"));
const cms = JSON.parse(readFileSync(join(ROOT, "data/cms.json"), "utf8"));

function loadPages() {
  return readdirSync(join(ROOT, "builder/pages"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => pageSchema.parse(migrateDocument(JSON.parse(readFileSync(join(ROOT, "builder/pages", f), "utf8")))));
}

export function generateStaticParams() {
  return loadPages().map((p) => ({ slug: p.slug === "index" ? [] : [p.slug] }));
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const target = slug?.join("/") || "index";
  const page = loadPages().find((p) => p.slug === target);
  if (!page) notFound();
  let themeCss = "";
  try {
    const theme = themeSchema.parse(migrateDocument(JSON.parse(readFileSync(join(ROOT, "builder/theme.json"), "utf8"))));
    themeCss = themeToCssVars(theme);
  } catch { /* no theme — tokens fall back to the stylesheet */ }
  return (
    <main>
      {themeCss ? <style>{themeCss}</style> : null}
      <BlockRenderer blocks={page.sections} catalog={catalog} cms={cms} />
    </main>
  );
}
`,
    "README.md": `# ${siteName} — Next.js export

A runnable Next.js project. The block renderer under src/builder/ is the
SAME code the builder's editor used — pages in builder/pages/*.json render
identically here.

    npm install
    npm run dev      # http://localhost:3000
    npm run build    # production build

Deploy anywhere Next.js runs (Vercel, Netlify, a node server). Catalog
data is a snapshot in data/catalog.json — regenerate the export to refresh.
`,
  };
}
