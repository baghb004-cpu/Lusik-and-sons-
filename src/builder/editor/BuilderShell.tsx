"use client";

// ============================================================
// Builder shell (Phase 3 skeleton + Phase 4 CMS forms)
// ============================================================
// Proves the pipeline end to end: auth → document API → storage
// adapter → save gate → override cascade → renderer. Phase 4
// adds the Lusik CMS adapter: the content/** collections appear
// grouped in the sidebar and edit through schema-driven FORMS
// (raw JSON stays available behind a toggle). Saves are gated
// server-side by the generators' own validators — including the
// trusted-products price reconciliation — so nothing the form
// (or hand-written JSON) produces can break the build or drift
// a price.
//
// Auth: a signed-in Identity admin (hosted mode) or the
// BUILDER_LOCAL_TOKEN (thumb-drive / home-server mode).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../../lib/auth.js";
import {
  validatePage,
  resolveBlocks,
  createPage,
  duplicatePage,
  pageToTemplate,
  pagePath,
  templatePath,
  suggestSlug,
  updateBlock,
  findBlock,
  moveBlock,
  moveBlockBy,
  removeBlock,
  duplicateBlock,
  setBlockLocks,
  overridePath,
  emptyLayer,
  listStaleOverrides,
  pruneStaleOverrides,
  createHistory,
  pushHistory,
  replaceHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  EngineError,
  type Device,
  type History,
  type ValidationIssue,
} from "../engine/index.ts";
import {
  templateSchema,
  overrideLayerSchema,
  migrateDocument,
  newId as newBlockId,
  type Page,
  type Template,
  type Block,
  type Breakpoint,
  type OverrideLayer,
} from "../schema/index.ts";
import { BlockRenderer } from "../renderer/index.ts";
// The real catalog (generated, gate-checked) — editor chunk only, for
// commerce-block preview + live binding validation. The featured pick
// rides the same generated pages data.
import { CATALOG } from "../../data/catalog.js";
import { CMS_PAGES } from "../../data/pagesData.generated.js";
import { validateCommerceRefs, type CatalogSnapshot } from "../engine/commerce.ts";
import { INSERTABLE_TYPES, newDefaultBlock, type InsertableType } from "./newBlock.ts";
import { ShippingPanel } from "./ShippingPanel.tsx";
import { AiPanel } from "./AiPanel.tsx";
import { AppPanel } from "./AppPanel.tsx";
import { PresetsPanel } from "./PresetsPanel.tsx";
import { MediaPanel } from "./MediaPanel.tsx";
import { ResponsivePreviewPanel } from "./ResponsivePreviewPanel.tsx";
import { applyPreset, rectScan, type ViewportPreset, type LayoutIssue, type MeasuredRect } from "../viewport/index.ts";
import {
  localizeBlocks,
  localeByCode,
  i18nSettingsSchema,
  DEFAULT_I18N_SETTINGS,
  I18N_SETTINGS_PATH,
  type I18nSettings,
  type LocaleCode,
} from "../i18n/index.ts";
import { SERVICES_PATH } from "../presets/selection.ts";
import { APP_DIR } from "../app/index.ts";
import { zipDatasetSchema, SHIPPING_DOC_PATH, type ZipDataset } from "../data/index.ts";
import { Inspector } from "./Inspector.tsx";
import { HitboxOverlay, type HitboxReport } from "./HitboxOverlay.tsx";
import { CanvasToolbar } from "./CanvasToolbar.tsx";
import { ResizeOverlay } from "./ResizeOverlay.tsx";

interface PageSnap {
  content: Obj;
  layers: Record<Breakpoint, OverrideLayer>;
}

/** Coalesce window: edits within this gap merge into one undo step. */
const UNDO_COALESCE_MS = 800;
import { DocForm } from "./Form.tsx";
import { ThemeEditor } from "./ThemeEditor.tsx";
import { themeSchema } from "../schema/index.ts";
import { themeToCssVars } from "../theme/css.ts";
import { LUSIK_COLLECTIONS, fieldsForPath, collectionForPath } from "../adapters/lusik/collections.ts";

const THEME_PATH = "builder/theme.json";

// Unique marker the bundle-budget gate greps public-route chunks
// for — if this string ever lands in a public route's first-load
// JS, the build fails. Do not rename without updating
// scripts/check-bundle-budget.mjs.
export const BUILDER_EDITOR_SENTINEL = "BUILDER_EDITOR_SENTINEL_9f3acaa1";

const LOCAL_TOKEN_KEY = "lusik_builder_local_token";

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

type Obj = Record<string, unknown>;

interface DocState {
  path: string;
  content: Obj;
  dirty: boolean;
}

interface SidebarGroup {
  label: string;
  blurb?: string;
  entries: Array<{ path: string; label: string }>;
}

function groupFiles(files: string[]): SidebarGroup[] {
  const used = new Set<string>();
  const groups: SidebarGroup[] = [];

  for (const c of LUSIK_COLLECTIONS) {
    const entries: SidebarGroup["entries"] = [];
    if (c.dir) {
      for (const f of files.filter((x) => x.startsWith(c.dir + "/"))) {
        used.add(f);
        entries.push({ path: f, label: f.slice(c.dir.length + 1).replace(/\.json$/, "") });
      }
    }
    for (const fixed of c.files ?? []) {
      if (files.includes(fixed.path)) {
        used.add(fixed.path);
        entries.push({ path: fixed.path, label: fixed.label });
      }
    }
    if (entries.length > 0) groups.push({ label: c.label, blurb: c.blurb, entries });
  }

  const appDocs = files.filter((f) => f.startsWith("builder/apps/") && !used.has(f));
  for (const a of appDocs) used.add(a);
  if (appDocs.length > 0) {
    groups.push({
      label: "App projects",
      blurb: "Guided app planning, compliance + PWA export",
      entries: appDocs.map((f) => ({ path: f, label: f.replace("builder/apps/", "").replace(/\.json$/, "") })),
    });
  }

  const dataDocs = files.filter((f) => f.startsWith("builder/data/") && !used.has(f));
  for (const d of dataDocs) used.add(d);
  if (dataDocs.length > 0) {
    groups.push({
      label: "Shipping & data",
      blurb: "Shipping rules + local ZIP datasets",
      entries: dataDocs.map((f) => ({ path: f, label: f.replace("builder/data/", "").replace(/\.json$/, "") })),
    });
  }

  const templates = files.filter((f) => f.startsWith("builder/templates/") && !used.has(f));
  for (const t of templates) used.add(t);
  if (templates.length > 0) {
    groups.push({
      label: "Templates",
      blurb: "Reusable section/page templates",
      entries: templates.map((f) => ({ path: f, label: f.replace("builder/templates/", "").replace(/\.json$/, "") })),
    });
  }

  const pages = files.filter((f) => f.startsWith("builder/pages/") && !used.has(f));
  for (const p of pages) used.add(p);
  if (pages.length > 0) {
    groups.push({
      label: "Pages",
      blurb: "Builder-managed pages",
      entries: pages.map((f) => ({ path: f, label: f.replace("builder/pages/", "").replace(/\.json$/, "") })),
    });
  }

  const builderEntries = files
    .filter((f) => !used.has(f))
    .map((f) => ({ path: f, label: f.replace(/^builder\//, "") }));
  if (builderEntries.length > 0) groups.push({ label: "Builder documents", entries: builderEntries });
  return groups;
}

export function BuilderShell() {
  const [token, setToken] = useState<string | null>(null);
  const [localTokenInput, setLocalTokenInput] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "out" | "in">("checking");
  const [files, setFiles] = useState<string[]>([]);
  const [backend, setBackend] = useState<string>("");
  const [doc, setDoc] = useState<DocState | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState<string>("");
  const [themeDoc, setThemeDoc] = useState<Obj | null>(null);
  const [dialog, setDialog] = useState<null | "newPage" | "duplicate" | "rename" | "saveTemplate">(null);
  const [dlgTitle, setDlgTitle] = useState("");
  const [dlgSlug, setDlgSlug] = useState("");
  const [dlgTemplate, setDlgTemplate] = useState("");
  // Phase 7 — the mobile editing layer
  const [layers, setLayers] = useState<Record<Breakpoint, OverrideLayer>>({
    tablet: emptyLayer("b_none00000000", "tablet"),
    mobile: emptyLayer("b_none00000000", "mobile"),
  });
  const [layersDirty, setLayersDirty] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hitboxOn, setHitboxOn] = useState(false);
  const [safeAreaOn, setSafeAreaOn] = useState(true);
  const [tapReport, setTapReport] = useState<HitboxReport | null>(null);
  const [previewEl, setPreviewEl] = useState<HTMLElement | null>(null);
  // Phase 9 — undo/redo over page content + override layers
  const [history, setHistory] = useState<History<PageSnap> | null>(null);
  const lastPushAt = useRef(0);
  // Phase 13 — imported ZIP datasets (loaded with the shipping doc)
  const [datasets, setDatasets] = useState<ZipDataset[]>([]);
  // Phase 14 — local AI panel toggle
  const [aiOpen, setAiOpen] = useState(false);
  // Media library panel (plan §20)
  const [mediaOpen, setMediaOpen] = useState(false);
  // Adaptive-layout (Screens) panel
  const [screensOpen, setScreensOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<ViewportPreset | null>(null);
  const [liveIssues, setLiveIssues] = useState<LayoutIssue[]>([]);
  // Offline languages
  const [i18nSettings, setI18nSettings] = useState<I18nSettings>(DEFAULT_I18N_SETTINGS);
  const [previewLocale, setPreviewLocale] = useState<LocaleCode>(DEFAULT_I18N_SETTINGS.defaultLocale);

  // ── auth bootstrapping ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Desktop shell hand-off: the .exe opens /builder#token=… with the
    // session token it generated for the local server. Store + strip.
    const hashToken = /^#token=(.+)$/.exec(window.location.hash)?.[1];
    if (hashToken && hashToken.length >= 16) {
      sessionStorage.setItem(LOCAL_TOKEN_KEY, hashToken);
      window.history.replaceState(null, "", window.location.pathname);
    }
    const resolveToken = async () => {
      const saved = sessionStorage.getItem(LOCAL_TOKEN_KEY);
      if (saved) {
        if (!cancelled) { setToken(saved); setAuthStatus("in"); }
        return;
      }
      const jwt = await auth.getToken();
      if (cancelled) return;
      if (jwt && auth.isAdmin()) { setToken(jwt); setAuthStatus("in"); }
      else setAuthStatus("out");
    };
    resolveToken();
    // auth is an untyped JS module; the unsubscribe return needs a cast.
    const off = auth.onAuthStateChange(() => resolveToken()) as unknown;
    return () => {
      cancelled = true;
      if (typeof off === "function") (off as () => void)();
    };
  }, []);

  const api = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const fresh = sessionStorage.getItem(LOCAL_TOKEN_KEY) || (await auth.getToken()) || token;
      const res = await fetch(input, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${fresh}` },
      });
      if (res.status === 401 || res.status === 403) {
        setAuthStatus("out");
        throw new Error((await res.json().catch(() => null))?.error || "Not authorized");
      }
      return res;
    },
    [token]
  );

  // ── document list (both roots) ────────────────────────────
  const refreshList = useCallback(async () => {
    const [b, c] = await Promise.all([
      api("/api/builder/docs?dir=builder"),
      api("/api/builder/docs?dir=content"),
    ]);
    if (!b.ok || !c.ok) throw new Error("Could not list documents");
    const bBody = await b.json();
    const cBody = await c.json();
    setFiles([...cBody.files, ...bBody.files]);
    setBackend(bBody.backend);
  }, [api]);

  useEffect(() => {
    if (authStatus === "in") {
      refreshList().catch((e) => setStatus(String(e.message || e)));
      // Load the theme once so page previews render with real tokens.
      api(`/api/builder/docs?path=${encodeURIComponent(THEME_PATH)}`)
        .then(async (res) => (res.ok ? setThemeDoc((await res.json()).content as Obj) : null))
        .catch(() => null);
      // Load language settings so the preview localizes + offers a toggle.
      api(`/api/builder/docs?path=${encodeURIComponent(I18N_SETTINGS_PATH)}`)
        .then(async (res) => {
          if (!res.ok) return;
          const parsed = i18nSettingsSchema.safeParse((await res.json()).content);
          if (parsed.success) {
            setI18nSettings(parsed.data);
            setPreviewLocale(parsed.data.defaultLocale);
          }
        })
        .catch(() => null);
    }
  }, [authStatus, refreshList, api]);

  // ── open / edit / save ────────────────────────────────────
  const openDoc = async (path: string) => {
    setStatus("");
    setIssues([]);
    setSelectedBlockId(null);
    setTapReport(null);
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setStatus("Could not open document"); return; }
    const body = await res.json();
    setDoc({ path, content: body.content as Obj, dirty: false });
    setJsonText(JSON.stringify(body.content, null, 2));
    setRawMode(false);

    // Shipping doc: load the imported datasets alongside it.
    if (path === SHIPPING_DOC_PATH) {
      await loadDatasets();
    }

    // Builder pages: pull their override layers (absent → fresh empty).
    if (path.startsWith("builder/pages/")) {
      const page = body.content as { id?: string; slug?: string };
      const pageId = typeof page.id === "string" ? page.id : "b_none00000000";
      const slug = typeof page.slug === "string" ? page.slug : "";
      const loaded: Record<Breakpoint, OverrideLayer> = {
        tablet: emptyLayer(pageId, "tablet"),
        mobile: emptyLayer(pageId, "mobile"),
      };
      for (const bp of ["tablet", "mobile"] as Breakpoint[]) {
        try {
          const r = await api(`/api/builder/docs?path=${encodeURIComponent(overridePath(slug, bp))}`);
          if (r.ok) {
            const parsed = overrideLayerSchema.safeParse(migrateDocument((await r.json()).content));
            if (parsed.success) loaded[bp] = parsed.data;
          }
        } catch { /* absent or invalid → empty layer */ }
      }
      setLayers(loaded);
      setLayersDirty(false);
      setHistory(createHistory({ content: body.content as Obj, layers: loaded }));
      lastPushAt.current = 0;
    } else {
      setHistory(null);
    }
  };

  const loadDatasets = useCallback(async () => {
    try {
      const res = await api("/api/builder/docs?dir=builder/data/datasets");
      if (!res.ok) return;
      const { files: datasetFiles } = await res.json();
      const loaded: ZipDataset[] = [];
      for (const f of datasetFiles as string[]) {
        const r = await api(`/api/builder/docs?path=${encodeURIComponent(f)}`);
        if (!r.ok) continue;
        const parsed = zipDatasetSchema.safeParse((await r.json()).content);
        if (parsed.success) loaded.push(parsed.data);
      }
      setDatasets(loaded);
    } catch {
      setDatasets([]);
    }
  }, [api]);

  // Central mutation for builder pages: applies the state AND records
  // the undo step (coalescing rapid edits like keystrokes/sliders).
  const commitPage = useCallback(
    (content: Obj, nextLayers: Record<Breakpoint, OverrideLayer>, opts: { coalesce?: boolean } = {}) => {
      setDoc((d) => (d ? { ...d, content, dirty: true } : d));
      setJsonText(JSON.stringify(content, null, 2));
      setLayers(nextLayers);
      setLayersDirty(true);
      setHistory((h) => {
        if (!h) return h;
        const snap: PageSnap = { content, layers: nextLayers };
        const now = Date.now();
        if (opts.coalesce && now - lastPushAt.current < UNDO_COALESCE_MS) {
          return replaceHistory(h, snap);
        }
        lastPushAt.current = now;
        return pushHistory(h, snap);
      });
    },
    []
  );

  const undoAction = useCallback(() => {
    setHistory((h) => {
      if (!h || !canUndo(h)) return h;
      const next = undo(h);
      setDoc((d) => (d ? { ...d, content: next.present.content, dirty: true } : d));
      setJsonText(JSON.stringify(next.present.content, null, 2));
      setLayers(next.present.layers);
      setLayersDirty(true);
      lastPushAt.current = 0;
      return next;
    });
  }, []);
  const redoAction = useCallback(() => {
    setHistory((h) => {
      if (!h || !canRedo(h)) return h;
      const next = redo(h);
      setDoc((d) => (d ? { ...d, content: next.present.content, dirty: true } : d));
      setJsonText(JSON.stringify(next.present.content, null, 2));
      setLayers(next.present.layers);
      setLayersDirty(true);
      lastPushAt.current = 0;
      return next;
    });
  }, []);

  const editContent = (next: Obj) => {
    if (!doc) return;
    if (doc.path.startsWith("builder/pages/")) {
      commitPage(next, layers, { coalesce: true });
      return;
    }
    setDoc({ ...doc, content: next, dirty: true });
    setJsonText(JSON.stringify(next, null, 2));
    if (doc.path === THEME_PATH) setThemeDoc(next); // page preview re-tokens live
    if (doc.path === I18N_SETTINGS_PATH) {
      const parsed = i18nSettingsSchema.safeParse(next);
      if (parsed.success) {
        setI18nSettings(parsed.data);
        if (!parsed.data.locales.includes(previewLocale)) setPreviewLocale(parsed.data.defaultLocale);
      }
    }
  };

  const applyRawJson = (): Obj | null => {
    try {
      return JSON.parse(jsonText) as Obj;
    } catch {
      setStatus("Not valid JSON — fix before saving");
      return null;
    }
  };

  const saveDoc = async () => {
    if (!doc) return;
    const content = rawMode ? applyRawJson() : doc.content;
    if (!content) return;
    setStatus("Saving…");
    const res = await api("/api/builder/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: doc.path, content }),
    });
    const body = await res.json();
    if (res.status === 422) {
      setIssues(body.issues);
      setStatus("The build gate refused this — nothing was saved");
      return;
    }
    if (!res.ok) { setStatus(body.error || "Save failed"); return; }

    // Builder pages: persist dirty override layers alongside the page.
    if (layersDirty && doc.path.startsWith("builder/pages/")) {
      const slug = String((content as Obj).slug ?? "");
      for (const bp of ["tablet", "mobile"] as Breakpoint[]) {
        const layer = layers[bp];
        const empty = Object.keys(layer.patches).length === 0 && layer.mobileOnlyBlocks.length === 0;
        const path = overridePath(slug, bp);
        if (empty) {
          await api(`/api/builder/docs?path=${encodeURIComponent(path)}`, { method: "DELETE" }).catch(() => null);
        } else {
          await api("/api/builder/docs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, content: layer }),
          });
        }
      }
      setLayersDirty(false);
    }

    setDoc({ path: doc.path, content, dirty: false });
    setJsonText(JSON.stringify(content, null, 2));
    setIssues([]);
    setStatus(`Saved ✓ (${body.backend})`);
  };

  // ── page & template operations (Phase 6) ──────────────────
  const writeDoc = async (path: string, content: unknown): Promise<boolean> => {
    const res = await api("/api/builder/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    const body = await res.json();
    if (res.status === 422) {
      setIssues(body.issues);
      setStatus("The build gate refused this — nothing was saved");
      return false;
    }
    if (!res.ok) {
      setStatus(body.error || "Save failed");
      return false;
    }
    return true;
  };

  const deleteDoc = async (path: string) => {
    if (!window.confirm(`Delete ${path}? Rollback is possible through git history, but the document leaves the builder now.`)) return;
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    if (!res.ok) { setStatus("Delete failed"); return; }
    if (doc?.path === path) setDoc(null);
    setStatus(`Deleted ${path}`);
    await refreshList();
  };

  const downloadDoc = () => {
    if (!doc) return;
    const blob = new Blob([JSON.stringify(doc.content, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = doc.path.split("/").pop()!;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importTemplate = async (file: File) => {
    try {
      const content = JSON.parse(await file.text());
      const parsed = templateSchema.safeParse(migrateDocument(content));
      if (!parsed.success) { setStatus(`Not a valid template: ${parsed.error.issues[0]?.message}`); return; }
      const path = templatePath(parsed.data.name);
      if (await writeDoc(path, parsed.data)) {
        setStatus(`Imported template → ${path}`);
        await refreshList();
      }
    } catch {
      setStatus("Import failed — file isn't valid JSON");
    }
  };

  const loadTemplate = async (path: string): Promise<Template | null> => {
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    const parsed = templateSchema.safeParse(migrateDocument((await res.json()).content));
    return parsed.success ? parsed.data : null;
  };

  const openDialog = (kind: NonNullable<typeof dialog>) => {
    setDlgTitle(kind === "rename" && doc ? String((doc.content as Obj).title ?? "") : "");
    setDlgSlug(kind === "rename" && doc ? String((doc.content as Obj).slug ?? "") : "");
    setDlgTemplate("");
    setDialog(kind);
  };

  const submitDialog = async () => {
    try {
      if (dialog === "newPage") {
        const slug = dlgSlug || suggestSlug(dlgTitle);
        const path = pagePath(slug);
        if (files.includes(path)) { setStatus(`A page with slug "${slug}" already exists`); return; }
        const template = dlgTemplate ? await loadTemplate(dlgTemplate) : null;
        const page = createPage({ title: dlgTitle, slug, template: template ?? undefined });
        if (await writeDoc(path, page)) {
          setDialog(null);
          await refreshList();
          await openDoc(path);
        }
      } else if (dialog === "duplicate" && parsedPage) {
        const slug = dlgSlug || suggestSlug(dlgTitle);
        const path = pagePath(slug);
        if (files.includes(path)) { setStatus(`A page with slug "${slug}" already exists`); return; }
        const copy = duplicatePage(parsedPage, dlgTitle, slug);
        if (await writeDoc(path, copy)) {
          setDialog(null);
          await refreshList();
          await openDoc(path);
        }
      } else if (dialog === "rename" && doc && parsedPage) {
        const slug = dlgSlug || suggestSlug(dlgTitle);
        const nextPath = pagePath(slug);
        const renamed: Page = { ...parsedPage, title: dlgTitle, slug };
        if (nextPath === doc.path) {
          if (await writeDoc(doc.path, renamed)) { setDialog(null); await openDoc(doc.path); }
        } else {
          if (files.includes(nextPath)) { setStatus(`A page with slug "${slug}" already exists`); return; }
          // slug change = write new path, then remove the old one
          if (await writeDoc(nextPath, renamed)) {
            await api(`/api/builder/docs?path=${encodeURIComponent(doc.path)}`, { method: "DELETE" });
            setDialog(null);
            await refreshList();
            await openDoc(nextPath);
            setStatus(`Renamed — heads up: the old URL slug is gone; add a redirect if it was shared.`);
          }
        }
      } else if (dialog === "saveTemplate" && parsedPage) {
        const tpl = pageToTemplate(parsedPage, dlgTitle);
        const path = templatePath(dlgTitle);
        if (await writeDoc(path, tpl)) {
          setDialog(null);
          setStatus(`Saved template “${dlgTitle}”`);
          await refreshList();
        }
      }
    } catch (err) {
      setStatus(err instanceof EngineError ? err.message : String(err));
    }
  };

  // ── live validation + preview (builder pages only) ────────
  // Catalog snapshot + featured pick for commerce blocks (editor copy of
  // what published pages get injected at build).
  const catalogSnapshot = useMemo<CatalogSnapshot>(
    () =>
      Object.fromEntries(
        Object.entries(CATALOG as Record<string, { products: CatalogSnapshot[string] }>).map(([cat, c]) => [cat, c.products])
      ),
    []
  );
  const cmsContext = useMemo(() => {
    const f = (CMS_PAGES as { home?: { featured?: { category: string; slug: string } } }).home?.featured;
    return { featured: f ? `${f.category}/${f.slug}` : undefined };
  }, []);

  const parsedPage = useMemo(() => {
    if (!doc || !doc.path.startsWith("builder/pages/")) return null;
    const result = validatePage(doc.content);
    const commerce = result.page ? validateCommerceRefs(result.page.sections, catalogSnapshot) : [];
    setIssues([...result.issues, ...commerce]);
    return result.page;
  }, [doc, catalogSnapshot]);

  const resolved = useMemo(() => {
    if (!parsedPage) return null;
    return resolveBlocks(parsedPage.sections, [layers.tablet, layers.mobile], device);
  }, [parsedPage, layers, device]);
  // Localize the preview to the chosen language so i18n maps render as text
  // (not "[object Object]") and the switcher/gate have a current locale.
  const previewBlocks = useMemo(() => {
    if (!resolved) return null;
    return localizeBlocks(resolved.blocks, previewLocale, i18nSettings.defaultLocale);
  }, [resolved, previewLocale, i18nSettings.defaultLocale]);
  const i18nRenderCtx = useMemo(
    () => ({
      locales: i18nSettings.locales.map((c) => ({ code: c, endonym: localeByCode(c)?.endonym ?? c })),
      current: previewLocale,
      hrefForLocale: (c: string) => `#lang-${c}`, // preview-only; export rewrites to real per-locale URLs
    }),
    [i18nSettings.locales, previewLocale]
  );

  const staleOverrides = useMemo(() => {
    if (!parsedPage) return [];
    return [
      ...listStaleOverrides(parsedPage.sections, layers.tablet),
      ...listStaleOverrides(parsedPage.sections, layers.mobile),
    ];
  }, [parsedPage, layers]);

  const setLayer = (bp: Breakpoint, next: OverrideLayer) => {
    if (doc?.path.startsWith("builder/pages/")) {
      commitPage(doc.content, { ...layers, [bp]: next }, { coalesce: true });
      return;
    }
    setLayers((prev) => ({ ...prev, [bp]: next }));
    setLayersDirty(true);
  };

  const setBaseVisibility = (id: string, dev: Device, visible: boolean) => {
    if (!doc || !parsedPage) return;
    try {
      const sections = updateBlock(parsedPage.sections, id, (b: Block) => ({
        ...b,
        visibility: { ...b.visibility, [dev]: visible ? undefined : false },
      }));
      editContent({ ...doc.content, sections });
    } catch (err) {
      setStatus(err instanceof EngineError ? err.message : String(err));
    }
  };

  const pruneStale = () => {
    if (!parsedPage || !doc) return;
    commitPage(doc.content, {
      tablet: pruneStaleOverrides(parsedPage.sections, layers.tablet),
      mobile: pruneStaleOverrides(parsedPage.sections, layers.mobile),
    });
  };

  // ── adaptive layout: apply a viewport preset's rules ───────
  const applyLayoutPreset = (preset: ViewportPreset) => {
    if (!parsedPage || !doc) return;
    try {
      const result = applyPreset(parsedPage, layers, preset);
      if (result.sections) {
        // desktop preset → base edit
        commitPage({ ...doc.content, sections: result.sections }, layers);
      } else if (result.layer) {
        commitPage(doc.content, { ...layers, [result.breakpoint as "tablet" | "mobile"]: result.layer });
        setDevice(result.breakpoint as Device);
      }
      setStatus(`Applied ${preset.label} layout (${result.breakpoint}): ${result.changes.join(", ")}`);
    } catch (err) {
      setStatus(err instanceof EngineError ? err.message : String(err));
    }
  };

  // Live rect scan: measure the real preview render at the active preset and
  // surface off-screen / overflow / overlap / safe-area issues the static
  // scan can't see. Guarded so a measurement hiccup never throws.
  useEffect(() => {
    if (!screensOpen || !activePreset || !previewEl) {
      setLiveIssues([]);
      return;
    }
    const raf = requestAnimationFrame(() => {
      try {
        const frame = previewEl.getBoundingClientRect();
        const rects: MeasuredRect[] = [];
        previewEl.querySelectorAll<HTMLElement>("[data-block-id], a, button, summary").forEach((el, i) => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) return;
          const cs = getComputedStyle(el);
          rects.push({
            id: el.getAttribute("data-block-id") ?? `el${i}`,
            label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 24) || el.tagName.toLowerCase(),
            x: b.left - frame.left,
            y: b.top - frame.top,
            width: b.width,
            height: b.height,
            fixed: cs.position === "fixed" || cs.position === "sticky",
          });
        });
        setLiveIssues(rectScan(rects, { width: activePreset.width, height: activePreset.height, safeArea: activePreset.safeArea }));
      } catch {
        setLiveIssues([]);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [screensOpen, activePreset, previewEl, jsonText, device]);

  // ── Phase 9: canvas actions on the selected block ──────────
  const withSections = (fn: (sections: Block[]) => Block[]) => {
    if (!doc || !parsedPage) return;
    try {
      commitPage({ ...doc.content, sections: fn(parsedPage.sections) }, layers);
    } catch (err) {
      setStatus(err instanceof EngineError ? err.message : String(err));
    }
  };

  const selectedBaseBlock = useMemo(() => {
    if (!parsedPage || !selectedBlockId) return null;
    return findBlock(parsedPage.sections, selectedBlockId)?.block ?? null;
  }, [parsedPage, selectedBlockId]);

  const handleMoveBy = (delta: -1 | 1) =>
    selectedBlockId && withSections((s) => moveBlockBy(s, selectedBlockId, delta));

  const handleDuplicate = () => {
    if (!selectedBlockId) return;
    withSections((s) => {
      const { blocks, copy } = duplicateBlock(s, selectedBlockId);
      setSelectedBlockId(copy.id);
      return blocks;
    });
  };

  const handleDelete = () => {
    if (!selectedBlockId) return;
    withSections((s) => {
      const { blocks } = removeBlock(s, selectedBlockId);
      setSelectedBlockId(null);
      return blocks;
    });
  };

  const handleToggleLock = () => {
    if (!selectedBlockId || !selectedBaseBlock) return;
    const locked = !!(selectedBaseBlock.locks?.move || selectedBaseBlock.locks?.delete);
    withSections((s) =>
      setBlockLocks(s, selectedBlockId, locked ? undefined : { move: true, delete: true, reason: "locked in the editor" })
    );
  };

  const handleRotate = () => {
    if (!selectedBlockId || selectedBaseBlock?.type !== "image") return;
    const current = Number((selectedBaseBlock.props as { rotate?: number }).rotate ?? 0);
    const next = ((current + 90) % 360) as 0 | 90 | 180 | 270;
    withSections((s) =>
      updateBlock(s, selectedBlockId, (b) => ({ ...b, props: { ...b.props, rotate: next === 0 ? undefined : next } }))
    );
  };

  const handleTreeMove = (dragId: string, afterId: string) => {
    withSections((s) => {
      const target = findBlock(s, afterId);
      if (!target) throw new EngineError("not_found", "Drop target vanished");
      return moveBlock(s, dragId, { parentId: target.parent?.id ?? null, index: target.index + 1 });
    });
  };

  const handleResizeCommit = (maxWidth: string) => {
    if (!selectedBlockId) return;
    withSections((s) =>
      updateBlock(s, selectedBlockId, (b) => ({
        ...b,
        style: { ...b.style, maxWidth: maxWidth === "full" ? undefined : maxWidth },
      }))
    );
  };

  // Keyboard: undo/redo + block actions (ignored while typing).
  // Stable listener, always-fresh logic: bind keydown ONCE, route through a
  // ref that every render refreshes. Avoids re-adding the window listener on
  // every render (the churn the review flagged) without dep-array ordering
  // games. The ref is assigned on each render just below.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (!isBuilderPage) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redoAction();
    } else if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId) {
      e.preventDefault();
      handleDelete();
    } else if (e.altKey && e.key === "ArrowUp" && selectedBlockId) {
      e.preventDefault();
      handleMoveBy(-1);
    } else if (e.altKey && e.key === "ArrowDown" && selectedBlockId) {
      e.preventDefault();
      handleMoveBy(1);
    } else if (e.key === "Escape") {
      setSelectedBlockId(null);
    }
  };

  const formFields = doc ? fieldsForPath(doc.path) : null;
  const collection = doc ? collectionForPath(doc.path) : null;
  const isThemeDoc = doc?.path === THEME_PATH;
  const isShippingDoc = doc?.path === SHIPPING_DOC_PATH;
  const isAppDoc = doc?.path.startsWith("builder/apps/") ?? false;
  const isServicesDoc = doc?.path === SERVICES_PATH;
  const isBuilderPage = doc?.path.startsWith("builder/pages/") ?? false;
  const isTemplate = doc?.path.startsWith("builder/templates/") ?? false;
  const pageTemplates = useMemo(
    () => files.filter((f) => f.startsWith("builder/templates/")),
    [files]
  );
  const groups = useMemo(() => groupFiles(files), [files]);

  // Compiled theme variables for the preview pane (invalid mid-edit
  // themes just keep the last good variables).
  const themeCss = useMemo(() => {
    if (!themeDoc) return "";
    const parsed = themeSchema.safeParse(themeDoc);
    return parsed.success ? themeToCssVars(parsed.data).replace(":root", ".bt-theme-scope") : "";
  }, [themeDoc]);

  // Glass presets for pillNav rendering + the pill editor's picker.
  const glassPresets = useMemo(() => {
    if (!themeDoc) return [];
    const parsed = themeSchema.safeParse(themeDoc);
    return parsed.success ? parsed.data.tokens.glass : [];
  }, [themeDoc]);

  const setBaseProps = (id: string, props: Record<string, unknown>) => {
    if (!doc || !parsedPage) return;
    try {
      const sections = updateBlock(parsedPage.sections, id, (b: Block) => ({ ...b, props }));
      editContent({ ...doc.content, sections });
    } catch (err) {
      setStatus(err instanceof EngineError ? err.message : String(err));
    }
  };

  const addPillNav = () => {
    if (!doc || !parsedPage) return;
    const pill: Block = {
      id: newBlockId(),
      type: "pillNav",
      props: {
        items: [
          { id: newBlockId(), icon: "home", label: "For You", href: "/" },
          { id: newBlockId(), icon: "shop", label: "Shop", href: "/shop" },
          { id: newBlockId(), icon: "journal", label: "Journal", href: "/journal" },
          { id: newBlockId(), icon: "bag", label: "Bag", href: "/cart" },
        ],
        position: "bottom",
        preset: glassPresets[0]?.name,
      },
      visibility: { desktop: false, tablet: false }, // phones are what it's for
    };
    editContent({ ...doc.content, sections: [...parsedPage.sections, pill] });
    setSelectedBlockId(pill.id);
    setDevice("mobile");
  };

  // ── render ────────────────────────────────────────────────
  if (authStatus === "checking") {
    return <Centered>Checking access…</Centered>;
  }

  if (authStatus === "out") {
    return (
      <Centered>
        <div className="w-full max-w-sm space-y-4 text-center" data-sentinel={BUILDER_EDITOR_SENTINEL}>
          <h1 className="font-display text-2xl">Builder access</h1>
          <p className="text-sm text-muted">Sign in with an admin account, or use a local access token (home-server / thumb-drive mode).</p>
          <button
            type="button"
            className="w-full rounded-full bg-ink px-4 py-2 text-cream"
            onClick={() => auth.raw()?.open("login")}
          >
            Sign in
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (localTokenInput.trim().length >= 16) {
                sessionStorage.setItem(LOCAL_TOKEN_KEY, localTokenInput.trim());
                setToken(localTokenInput.trim());
                setAuthStatus("in");
              }
            }}
          >
            <input
              type="password"
              value={localTokenInput}
              onChange={(e) => setLocalTokenInput(e.target.value)}
              placeholder="Local access token"
              className="min-w-0 flex-1 rounded-full border border-ink/20 bg-white/70 px-4 py-2 text-sm"
            />
            <button type="submit" className="rounded-full border border-ink/20 px-4 py-2 text-sm">Use</button>
          </form>
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-body text-ink">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Baghdo’s Workshop</h1>
          <p className="text-xs text-muted">storage: {backend || "…"} · saves run the build’s own validators</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen(!aiOpen)}
            className={aiOpen ? "rounded-full bg-accent px-3 py-1 text-sm text-cream" : "rounded-full border border-ink/20 px-3 py-1 text-sm"}
            title="Local AI assistant (runs on your machine, offline)"
          >
            ✨ AI
          </button>
          <button
            type="button"
            onClick={() => setMediaOpen(!mediaOpen)}
            className={mediaOpen ? "rounded-full bg-accent px-3 py-1 text-sm text-cream" : "rounded-full border border-ink/20 px-3 py-1 text-sm"}
            title="Media library — drag photos in, use them anywhere"
          >
            🖼 Media
          </button>
          <button
            type="button"
            onClick={() => { setScreensOpen(!screensOpen); if (screensOpen) setActivePreset(null); }}
            className={screensOpen ? "rounded-full bg-accent px-3 py-1 text-sm text-cream" : "rounded-full border border-ink/20 px-3 py-1 text-sm"}
            title="Screen ratios & adaptive layout"
          >
            ▢ Screens
          </button>
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={
                d === device
                  ? "rounded-full bg-ink px-3 py-1 text-sm text-cream"
                  : "rounded-full border border-ink/20 px-3 py-1 text-sm"
              }
            >
              {d}
            </button>
          ))}
          {isBuilderPage ? (
            <>
              <button
                type="button"
                onClick={undoAction}
                disabled={!history || !canUndo(history)}
                title="Undo (Ctrl/Cmd+Z)"
                className="rounded-full border border-ink/20 px-3 py-1 text-sm disabled:opacity-30"
              >
                ↩ Undo
              </button>
              <button
                type="button"
                onClick={redoAction}
                disabled={!history || !canRedo(history)}
                title="Redo (Ctrl/Cmd+Shift+Z)"
                className="rounded-full border border-ink/20 px-3 py-1 text-sm disabled:opacity-30"
              >
                ↪ Redo
              </button>
              <button
                type="button"
                onClick={() => setHitboxOn(!hitboxOn)}
                className={
                  hitboxOn
                    ? "rounded-full bg-accent px-3 py-1 text-sm text-cream"
                    : "rounded-full border border-ink/20 px-3 py-1 text-sm"
                }
                title="Show tap targets — red = under 44px or overlapping"
              >
                ◎ Hit boxes
              </button>
              {device === "mobile" ? (
                <button
                  type="button"
                  onClick={() => setSafeAreaOn(!safeAreaOn)}
                  className={
                    safeAreaOn
                      ? "rounded-full bg-ink/80 px-3 py-1 text-sm text-cream"
                      : "rounded-full border border-ink/20 px-3 py-1 text-sm"
                  }
                  title="Simulate the notch + home-indicator zones"
                >
                  ▭ Safe areas
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {status ? <p className="mb-3 text-sm text-accent">{status}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_400px]">
        {/* documents, grouped by collection */}
        <nav className="space-y-4 rounded-xl border border-ink/10 p-3">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => openDialog("newPage")} className="rounded-full bg-ink px-3 py-1 text-xs text-cream">
              + New page
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt("App project name?");
                if (!name?.trim()) return;
                const slug = suggestSlug(name);
                const path = `${APP_DIR}/${slug}.json`;
                if (files.includes(path)) { setStatus(`An app project "${slug}" already exists`); return; }
                const project = { schemaVersion: 1, id: newBlockId("app"), name: name.trim(), slug, answers: {}, checkedItems: [], notes: "" };
                if (await writeDoc(path, project)) {
                  await refreshList();
                  await openDoc(path);
                }
              }}
              className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream"
            >
              + New app
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = window.confirm("OK = static HTML export (zero JS, deploy anywhere)\nCancel = Next.js project export") ? "static" : "next";
                setStatus(`Exporting ${target}…`);
                try {
                  const res = await api("/api/builder/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target }),
                  });
                  const body = await res.json();
                  if (!res.ok) { setStatus(body.error || "Export failed"); return; }
                  const skipped = body.skipped?.length ? ` (${body.skipped.length} page(s) skipped — failed gates)` : "";
                  setStatus(`Exported ${body.pages} page(s) → ${body.outDir}${skipped}`);
                } catch (e) {
                  setStatus(String((e as Error).message || e));
                }
              }}
              className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream"
            >
              Export site ↓
            </button>
            <button
              type="button"
              onClick={async () => {
                setStatus("Building backup…");
                try {
                  const res = await api("/api/builder/backup");
                  if (!res.ok) { setStatus("Backup failed"); return; }
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `builder-backup-${new Date().toISOString().slice(0, 10)}.zip`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  setStatus("Backup downloaded ✓ — keep a copy on the thumb drive");
                } catch (e) {
                  setStatus(String((e as Error).message || e));
                }
              }}
              className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream"
            >
              Backup ↓
            </button>
            <label className="cursor-pointer rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">
              Restore ↑
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!window.confirm(`Restore "${f.name}"? Valid documents replace the current ones (all-or-nothing; git history keeps the previous state).`)) return;
                  setStatus("Validating backup…");
                  try {
                    const res = await api("/api/builder/backup", { method: "POST", body: f });
                    const body = await res.json();
                    if (!res.ok) {
                      setStatus(`Restore refused: ${body.problems?.[0]?.path ?? ""} — ${body.problems?.[0]?.issues?.[0]?.message ?? body.error}`);
                      return;
                    }
                    setStatus(`Restored ${body.written.length} document(s) ✓`);
                    setDoc(null);
                    await refreshList();
                  } catch (err) {
                    setStatus(String((err as Error).message || err));
                  }
                }}
              />
            </label>
            <label className="cursor-pointer rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">
              Import template
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importTemplate(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {groups.map((g) => (
            <div key={g.label}>
              <h2 className="mb-1 text-xs uppercase tracking-wide text-muted" title={g.blurb}>{g.label}</h2>
              <ul className="space-y-0.5 text-sm">
                {g.entries.map((e) => (
                  <li key={e.path}>
                    <button
                      type="button"
                      onClick={() => openDoc(e.path)}
                      className={
                        doc?.path === e.path
                          ? "w-full truncate rounded px-2 py-1 text-left font-medium bg-cream"
                          : "w-full truncate rounded px-2 py-1 text-left hover:bg-cream/60"
                      }
                      title={e.path}
                    >
                      {e.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length === 0 ? <p className="text-sm text-muted">No documents yet</p> : null}
        </nav>

        {/* preview (builder pages) */}
        <main className="min-h-[60vh] overflow-auto rounded-xl border border-ink/10 bg-white/40 p-4">
          {isBuilderPage && i18nSettings.locales.length > 1 ? (
            <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted">Preview language:</span>
              {i18nSettings.locales.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPreviewLocale(c)}
                  className={c === previewLocale ? "rounded-full bg-ink px-2.5 py-1 text-cream" : "rounded-full border border-ink/20 px-2.5 py-1 hover:bg-cream"}
                >
                  {localeByCode(c)?.endonym ?? c}
                </button>
              ))}
            </div>
          ) : null}
          {previewBlocks ? (
            <div
              ref={setPreviewEl}
              dir={localeByCode(previewLocale)?.dir ?? "ltr"}
              data-locale={previewLocale}
              className="bt-theme-scope relative mx-auto min-h-full border border-dashed border-ink/10 bg-cream/40 transition-[max-width]"
              style={
                activePreset
                  ? { width: activePreset.width, maxWidth: "none", minHeight: activePreset.height, fontFamily: localeByCode(previewLocale)?.fontStack }
                  : { maxWidth: DEVICE_WIDTH[device], fontFamily: localeByCode(previewLocale)?.fontStack }
              }
              onClick={(e) => {
                const hit = (e.target as HTMLElement).closest("[data-block-id]");
                if (hit) {
                  e.preventDefault();
                  setSelectedBlockId(hit.getAttribute("data-block-id"));
                }
              }}
            >
              {themeCss ? <style>{themeCss}</style> : null}
              {selectedBlockId ? (
                <style>{`[data-block-id="${selectedBlockId}"]{outline:2px solid #B08842;outline-offset:2px;border-radius:4px}`}</style>
              ) : null}
              {/* preset safe-area + hinge overlays (Screens mode) */}
              {activePreset?.safeArea ? (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-ink/15" style={{ height: activePreset.safeArea.top }} aria-hidden="true" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-ink/15" style={{ height: activePreset.safeArea.bottom }} aria-hidden="true" />
                </>
              ) : null}
              {activePreset?.hinge ? (
                <div
                  className="pointer-events-none absolute z-20 bg-accent/25"
                  style={
                    activePreset.hinge.axis === "vertical"
                      ? { top: 0, bottom: 0, left: `calc(${activePreset.hinge.position * 100}% - ${activePreset.hinge.widthPx / 2}px)`, width: activePreset.hinge.widthPx }
                      : { left: 0, right: 0, top: `calc(${activePreset.hinge.position * 100}% - ${activePreset.hinge.widthPx / 2}px)`, height: activePreset.hinge.widthPx }
                  }
                  aria-hidden="true"
                />
              ) : null}
              {device === "mobile" && safeAreaOn ? (
                <>
                  <div className="pointer-events-none sticky top-0 z-10 h-8 bg-ink/15 text-center text-[10px] leading-8 text-ink/60" aria-hidden="true">
                    status bar / notch — keep tappables out
                  </div>
                </>
              ) : null}
              <BlockRenderer blocks={previewBlocks} glass={glassPresets} catalog={catalogSnapshot} cms={cmsContext} i18n={i18nRenderCtx} editing />
              {device === "mobile" && safeAreaOn ? (
                <div className="pointer-events-none sticky bottom-0 z-10 h-7 bg-ink/15 text-center text-[10px] leading-7 text-ink/60" aria-hidden="true">
                  home indicator — env(safe-area-inset-bottom)
                </div>
              ) : null}
              {hitboxOn ? (
                <HitboxOverlay
                  container={previewEl}
                  refreshKey={`${device}|${jsonText.length}|${layersDirty}|${selectedBlockId}`}
                  onReport={setTapReport}
                />
              ) : null}
              {selectedBaseBlock ? (
                <CanvasToolbar
                  block={selectedBaseBlock}
                  onMoveBy={handleMoveBy}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onToggleLock={handleToggleLock}
                  onRotate={selectedBaseBlock.type === "image" ? handleRotate : undefined}
                  onClose={() => setSelectedBlockId(null)}
                />
              ) : null}
              {selectedBaseBlock && previewEl && device === "desktop" ? (
                <ResizeOverlay
                  container={previewEl}
                  blockId={selectedBaseBlock.id}
                  refreshKey={`${jsonText.length}|${device}`}
                  onCommit={handleResizeCommit}
                />
              ) : null}
            </div>
          ) : (
            <Centered>
              <span className="max-w-sm text-center text-muted">
                {doc
                  ? collection
                    ? `${collection.label}: edits here publish to the live site through the build gate. Live preview for content collections arrives with the page migrations (Phase 6).`
                    : "This document type previews in a later phase."
                  : "Open a document to begin."}
              </span>
            </Centered>
          )}
        </main>

        {/* edit panel */}
        <aside className="space-y-3">
          {screensOpen && isBuilderPage ? (
            <ResponsivePreviewPanel
              page={parsedPage}
              activePresetId={activePreset?.id ?? null}
              liveIssues={liveIssues}
              onSelectPreset={(preset) => {
                setActivePreset(preset);
                setStatus(`Previewing ${preset.label} — ${preset.width}×${preset.height}`);
              }}
              onApplyPreset={applyLayoutPreset}
              onGenerateFixes={applyLayoutPreset}
            />
          ) : null}
          {mediaOpen ? (
            <MediaPanel
              api={api}
              canInsert={isBuilderPage && !!parsedPage}
              onInsertBlock={(block) => withSections((s) => [...s, block])}
              onUseForSelected={
                selectedBaseBlock?.type === "image" && selectedBlockId
                  ? (path) =>
                      withSections((s) =>
                        updateBlock(s, selectedBlockId, (b) => ({ ...b, props: { ...b.props, src: path } }))
                      )
                  : null
              }
              setStatus={setStatus}
            />
          ) : null}
          {aiOpen ? (
            <AiPanel
              api={api}
              canInsertBlocks={isBuilderPage && !!parsedPage}
              onInsertBlocks={(blocks) => withSections((s) => [...s, ...blocks])}
              setStatus={setStatus}
            />
          ) : null}
          {doc ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-sm font-medium" title={doc.path}>
                  {doc.path}
                  {doc.dirty ? <span className="ml-1 text-accent">•</span> : null}
                </h2>
                <div className="flex shrink-0 gap-2">
                  {formFields || isThemeDoc || isBuilderPage || isShippingDoc || isAppDoc || isServicesDoc ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (rawMode) {
                          const parsed = applyRawJson();
                          if (!parsed) return;
                          setDoc({ ...doc, content: parsed, dirty: true });
                        }
                        setRawMode(!rawMode);
                      }}
                      className="rounded-full border border-ink/20 px-3 py-1.5 text-xs"
                    >
                      {rawMode ? "Form" : "JSON"}
                    </button>
                  ) : null}
                  <button type="button" onClick={saveDoc} className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream">
                    Save
                  </button>
                </div>
              </div>

              {/* page / template lifecycle actions */}
              {(isBuilderPage || isTemplate) ? (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {isBuilderPage ? (
                    <>
                      <ActionBtn onClick={() => openDialog("duplicate")}>Duplicate</ActionBtn>
                      <ActionBtn onClick={() => openDialog("rename")}>Rename / slug</ActionBtn>
                      <ActionBtn onClick={() => openDialog("saveTemplate")}>Save as template</ActionBtn>
                    </>
                  ) : null}
                  <ActionBtn onClick={downloadDoc}>Export ↓</ActionBtn>
                  <ActionBtn onClick={() => deleteDoc(doc.path)} danger>Delete</ActionBtn>
                </div>
              ) : null}

              <HistoryPanel
                key={doc.path}
                path={doc.path}
                api={api}
                onLoadRevision={(content) => {
                  editContent(content as Obj);
                  setStatus("Old version loaded as a draft — review it, then Save to restore (runs the normal gates)");
                }}
              />

              {isBuilderPage && !rawMode && parsedPage ? (
                <div className="max-h-[62vh] overflow-y-auto">
                  <AddBlockMenu
                    onAdd={(type) => {
                      const block = newDefaultBlock(type, catalogSnapshot);
                      withSections((s) => [...s, block]);
                      setSelectedBlockId(block.id);
                    }}
                  />
                  {!parsedPage.sections.some((b) => b.type === "pillNav") ? (
                    <button
                      type="button"
                      onClick={addPillNav}
                      className="mb-2 w-full rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium hover:bg-accent/20"
                    >
                      + Add Liquid Glass pill menu
                    </button>
                  ) : null}
                  <Inspector
                    blocks={previewBlocks ?? parsedPage.sections}
                    layers={layers}
                    device={device}
                    selectedId={selectedBlockId}
                    glass={glassPresets}
                    onSelect={setSelectedBlockId}
                    onLayerChange={setLayer}
                    onBlockVisibility={setBaseVisibility}
                    onBlockProps={setBaseProps}
                    onMove={handleTreeMove}
                  />
                </div>
              ) : isServicesDoc && !rawMode ? (
                <div className="max-h-[62vh] overflow-y-auto">
                  <PresetsPanel value={doc.content} onChange={editContent} />
                </div>
              ) : isAppDoc && !rawMode ? (
                <div className="max-h-[62vh] overflow-y-auto">
                  <AppPanel
                    value={doc.content}
                    onChange={editContent}
                    onExportPwa={async () => {
                      setStatus("Exporting PWA…");
                      try {
                        const res = await api("/api/builder/export", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ target: "pwa" }),
                        });
                        const body = await res.json();
                        setStatus(res.ok ? `PWA exported: ${body.pages} page(s) → ${body.outDir}` : body.error || "Export failed");
                      } catch (e) {
                        setStatus(String((e as Error).message || e));
                      }
                    }}
                    onExportSwiftUI={async () => {
                      setStatus("Generating SwiftUI project…");
                      try {
                        const res = await api("/api/builder/export", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ target: "swiftui" }),
                        });
                        const body = await res.json();
                        setStatus(res.ok ? `SwiftUI project generated → ${body.outDir} (open on a Mac in Xcode)` : body.error || "Export failed");
                      } catch (e) {
                        setStatus(String((e as Error).message || e));
                      }
                    }}
                  />
                </div>
              ) : isShippingDoc && !rawMode ? (
                <div className="max-h-[62vh] overflow-y-auto">
                  <ShippingPanel
                    value={doc.content}
                    datasets={datasets}
                    api={api}
                    onChange={editContent}
                    onImportDataset={async (p, c) => {
                      const ok = await writeDoc(p, c);
                      if (ok) {
                        setStatus(`Dataset saved → ${p}`);
                        await refreshList();
                        await loadDatasets();
                      }
                      return ok;
                    }}
                  />
                </div>
              ) : isThemeDoc && !rawMode ? (
                <div className="max-h-[62vh] overflow-y-auto">
                  <ThemeEditor value={doc.content} onChange={editContent} />
                </div>
              ) : formFields && !rawMode ? (
                <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-ink/10 bg-white/50 p-3">
                  <DocForm fields={formFields} value={doc.content} onChange={editContent} />
                </div>
              ) : (
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                  className="h-[50vh] w-full rounded-xl border border-ink/10 bg-white/70 p-3 font-mono text-xs"
                />
              )}

              <div className="rounded-xl border border-ink/10 p-3">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Validation</h3>
                {issues.length === 0 ? (
                  <p className="text-sm text-muted">No issues ✓</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {issues.map((i, n) => (
                      <li key={n} className={i.level === "error" ? "text-red-700" : "text-accent"}>
                        <span className="font-mono text-xs">[{i.code}]</span> {i.message}
                      </li>
                    ))}
                  </ul>
                )}
                {staleOverrides.length > 0 ? (
                  <div className="mt-2 rounded bg-accent/10 p-2 text-xs">
                    {staleOverrides.length} override(s) point at blocks that no longer exist.{" "}
                    <button type="button" onClick={pruneStale} className="font-medium underline">Prune them</button>
                  </div>
                ) : null}
                {hitboxOn && tapReport ? (
                  <div className="mt-2 text-xs">
                    <h4 className="mb-1 uppercase tracking-wide text-muted">Tap targets ({device})</h4>
                    {tapReport.issues.length === 0 ? (
                      <p className="text-muted">{tapReport.rects.length} target(s), all comfortable ✓</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {tapReport.issues.map((t, n) => (
                          <li key={n} className="text-red-700">{t.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {layersDirty ? (
                  <p className="mt-2 text-xs text-accent">Device overrides changed — Save writes them with the page.</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Select a document to edit it.</p>
          )}
        </aside>
      </div>

      {dialog ? (
        <Dialog
          mode={dialog}
          title={dlgTitle}
          slug={dlgSlug}
          template={dlgTemplate}
          templates={pageTemplates}
          onTitle={(t) => {
            setDlgTitle(t);
            if (dialog !== "rename") setDlgSlug(suggestSlug(t));
          }}
          onSlug={setDlgSlug}
          onTemplate={setDlgTemplate}
          onCancel={() => setDialog(null)}
          onSubmit={submitDialog}
        />
      ) : null}
    </div>
  );
}

interface RevisionRow {
  sha: string;
  date: string;
  author: string;
  message: string;
}

function HistoryPanel({
  path,
  api,
  onLoadRevision,
}: {
  path: string;
  api: (input: string, init?: RequestInit) => Promise<Response>;
  onLoadRevision: (content: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionRow[] | null>(null);

  const load = async () => {
    setOpen(!open);
    if (revisions || open) return;
    try {
      const res = await api(`/api/builder/revisions?path=${encodeURIComponent(path)}`);
      setRevisions(res.ok ? (await res.json()).revisions : []);
    } catch {
      setRevisions([]);
    }
  };

  return (
    <div className="rounded-xl border border-ink/10">
      <button type="button" onClick={load} className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium">
        History (git)
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <ul className="max-h-44 space-y-1 overflow-y-auto px-3 pb-2 text-xs">
          {revisions === null ? (
            <li className="text-muted">Loading…</li>
          ) : revisions.length === 0 ? (
            <li className="text-muted">No history yet — every Save becomes a revision.</li>
          ) : (
            revisions.map((r) => (
              <li key={r.sha} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate" title={r.message}>{r.message}</span>
                  <span className="text-[10px] text-muted">{r.date.slice(0, 10)} · {r.author} · {r.sha.slice(0, 7)}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api(`/api/builder/revisions?path=${encodeURIComponent(path)}&sha=${r.sha}`);
                    if (res.ok) onLoadRevision((await res.json()).content);
                  }}
                  className="shrink-0 rounded-full border border-ink/20 px-2 py-0.5 text-[11px] hover:bg-cream"
                >
                  Load
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (type: InsertableType) => void }) {
  const [value, setValue] = useState<"" | InsertableType>("");
  return (
    <div className="mb-2 flex gap-1.5">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as InsertableType)}
        className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs"
        aria-label="Block type to add"
      >
        <option value="" disabled>+ Add block…</option>
        {INSERTABLE_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          if (value) onAdd(value);
          setValue("");
        }}
        className="rounded-full bg-ink px-3 py-1 text-xs text-cream disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function ActionBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "rounded-full border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
          : "rounded-full border border-ink/20 px-3 py-1 hover:bg-cream"
      }
    >
      {children}
    </button>
  );
}

const DIALOG_TITLES: Record<string, string> = {
  newPage: "New page",
  duplicate: "Duplicate page",
  rename: "Rename page",
  saveTemplate: "Save as template",
};

function Dialog({
  mode,
  title,
  slug,
  template,
  templates,
  onTitle,
  onSlug,
  onTemplate,
  onCancel,
  onSubmit,
}: {
  mode: string;
  title: string;
  slug: string;
  template: string;
  templates: string[];
  onTitle: (v: string) => void;
  onSlug: (v: string) => void;
  onTemplate: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const needsSlug = mode !== "saveTemplate";
  const titleLabel = mode === "saveTemplate" ? "Template name" : "Page title";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-cream p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-xl">{DIALOG_TITLES[mode]}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{titleLabel}</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              className="w-full rounded-lg border border-ink/20 bg-white/80 px-3 py-2 text-sm"
            />
          </label>
          {needsSlug ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">URL slug</span>
              <input
                value={slug}
                onChange={(e) => onSlug(e.target.value)}
                placeholder="auto from title"
                className="w-full rounded-lg border border-ink/20 bg-white/80 px-3 py-2 font-mono text-xs"
              />
              <span className="mt-1 block text-xs text-muted">/{slug || "…"} — lowercase-kebab-case</span>
            </label>
          ) : null}
          {mode === "newPage" && templates.length > 0 ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Start from</span>
              <select value={template} onChange={(e) => onTemplate(e.target.value)} className="w-full rounded-lg border border-ink/20 bg-white/80 px-3 py-2 text-sm">
                <option value="">Blank page</option>
                {templates.map((t) => (
                  <option key={t} value={t}>{t.replace("builder/templates/", "").replace(/\.json$/, "")}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream disabled:opacity-40">
              {mode === "rename" ? "Rename" : mode === "saveTemplate" ? "Save template" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center p-6">{children}</div>;
}
