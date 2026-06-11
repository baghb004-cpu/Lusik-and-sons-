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

import { useCallback, useEffect, useMemo, useState } from "react";
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
  EngineError,
  type Device,
  type ValidationIssue,
} from "../engine/index.ts";
import { templateSchema, migrateDocument, type Page, type Template } from "../schema/index.ts";
import { BlockRenderer } from "../renderer/index.ts";
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

  // ── auth bootstrapping ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
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
    }
  }, [authStatus, refreshList, api]);

  // ── open / edit / save ────────────────────────────────────
  const openDoc = async (path: string) => {
    setStatus("");
    setIssues([]);
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setStatus("Could not open document"); return; }
    const body = await res.json();
    setDoc({ path, content: body.content as Obj, dirty: false });
    setJsonText(JSON.stringify(body.content, null, 2));
    setRawMode(false);
  };

  const editContent = (next: Obj) => {
    if (!doc) return;
    setDoc({ ...doc, content: next, dirty: true });
    setJsonText(JSON.stringify(next, null, 2));
    if (doc.path === THEME_PATH) setThemeDoc(next); // page preview re-tokens live
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
  const parsedPage = useMemo(() => {
    if (!doc || !doc.path.startsWith("builder/pages/")) return null;
    const result = validatePage(doc.content);
    setIssues(result.issues);
    return result.page;
  }, [doc]);

  const previewBlocks = useMemo(() => {
    if (!parsedPage) return null;
    return resolveBlocks(parsedPage.sections, [], device).blocks;
  }, [parsedPage, device]);

  const formFields = doc ? fieldsForPath(doc.path) : null;
  const collection = doc ? collectionForPath(doc.path) : null;
  const isThemeDoc = doc?.path === THEME_PATH;
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
          <h1 className="font-display text-2xl">Builder</h1>
          <p className="text-xs text-muted">storage: {backend || "…"} · saves run the build’s own validators</p>
        </div>
        <div className="flex items-center gap-2">
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
          {previewBlocks ? (
            <div
              className="bt-theme-scope mx-auto min-h-full border border-dashed border-ink/10 bg-cream/40 transition-[max-width]"
              style={{ maxWidth: DEVICE_WIDTH[device] }}
            >
              {themeCss ? <style>{themeCss}</style> : null}
              <BlockRenderer blocks={previewBlocks} editing />
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
          {doc ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-sm font-medium" title={doc.path}>
                  {doc.path}
                  {doc.dirty ? <span className="ml-1 text-accent">•</span> : null}
                </h2>
                <div className="flex shrink-0 gap-2">
                  {formFields || isThemeDoc ? (
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

              {isThemeDoc && !rawMode ? (
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
