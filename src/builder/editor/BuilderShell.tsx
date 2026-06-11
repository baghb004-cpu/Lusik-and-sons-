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
import { validatePage, resolveBlocks, type Device, type ValidationIssue } from "../engine/index.ts";
import { BlockRenderer } from "../renderer/index.ts";
import { DocForm } from "./Form.tsx";
import { LUSIK_COLLECTIONS, fieldsForPath, collectionForPath } from "../adapters/lusik/collections.ts";

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
    }
  }, [authStatus, refreshList]);

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
  const groups = useMemo(() => groupFiles(files), [files]);

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
              className="mx-auto min-h-full border border-dashed border-ink/10 bg-cream/40 transition-[max-width]"
              style={{ maxWidth: DEVICE_WIDTH[device] }}
            >
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
                  {formFields ? (
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

              {formFields && !rawMode ? (
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
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center p-6">{children}</div>;
}
