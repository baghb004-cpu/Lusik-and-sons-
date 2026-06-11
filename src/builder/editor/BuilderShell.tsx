"use client";

// ============================================================
// Builder shell (Phase 3) — list, open, preview, validate
// ============================================================
// The walking skeleton that proves the whole pipeline end to
// end: auth → document API → storage adapter → schema gate →
// override cascade → renderer, with a desktop/tablet/mobile
// device preview. Editing FORMS arrive in Phase 4; this phase's
// "editing" is the raw JSON panel (already schema-gated on save,
// so even hand-edited JSON can't publish unsafely).
//
// Auth: a signed-in Identity admin (hosted mode) or the
// BUILDER_LOCAL_TOKEN (thumb-drive / home-server mode, entered
// once and kept in sessionStorage).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../../lib/auth.js";
import { validatePage, resolveBlocks, type Device, type ValidationIssue } from "../engine/index.ts";
import type { Page } from "../schema/index.ts";
import { BlockRenderer } from "../renderer/index.ts";

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

interface DocState {
  path: string;
  content: unknown;
  dirty: boolean;
}

export function BuilderShell() {
  const [token, setToken] = useState<string | null>(null);
  const [localTokenInput, setLocalTokenInput] = useState("");
  const [authStatus, setAuthStatus] = useState<"checking" | "out" | "in">("checking");
  const [files, setFiles] = useState<string[]>([]);
  const [backend, setBackend] = useState<string>("");
  const [doc, setDoc] = useState<DocState | null>(null);
  const [jsonText, setJsonText] = useState("");
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

  // ── document list ─────────────────────────────────────────
  const refreshList = useCallback(async () => {
    const res = await api("/api/builder/docs?dir=builder");
    if (!res.ok) throw new Error("Could not list documents");
    const body = await res.json();
    setFiles(body.files);
    setBackend(body.backend);
  }, [api]);

  useEffect(() => {
    if (authStatus === "in") {
      refreshList().catch((e) => setStatus(String(e.message || e)));
    }
  }, [authStatus, refreshList]);

  // ── open / save ───────────────────────────────────────────
  const openDoc = async (path: string) => {
    setStatus("");
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setStatus("Could not open document"); return; }
    const body = await res.json();
    setDoc({ path, content: body.content, dirty: false });
    setJsonText(JSON.stringify(body.content, null, 2));
  };

  const saveDoc = async () => {
    if (!doc) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatus("Not valid JSON — fix before saving");
      return;
    }
    setStatus("Saving…");
    const res = await api("/api/builder/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: doc.path, content: parsed }),
    });
    const body = await res.json();
    if (res.status === 422) {
      setIssues(body.issues);
      setStatus("Validation failed — nothing was saved");
      return;
    }
    if (!res.ok) { setStatus(body.error || "Save failed"); return; }
    setDoc({ path: doc.path, content: parsed, dirty: false });
    setStatus(`Saved ✓ (${body.backend})`);
  };

  // ── live validation + preview resolution ──────────────────
  const parsedPage: Page | null = useMemo(() => {
    if (!doc || !doc.path.startsWith("builder/pages/")) return null;
    try {
      const result = validatePage(JSON.parse(jsonText));
      setIssues(result.issues);
      return result.page;
    } catch {
      return null;
    }
  }, [doc, jsonText]);

  const previewBlocks = useMemo(() => {
    if (!parsedPage) return null;
    return resolveBlocks(parsedPage.sections, [], device).blocks;
  }, [parsedPage, device]);

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
          <p className="text-xs text-muted">storage: {backend || "…"} · Phase 3 shell — forms land in Phase 4</p>
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

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_360px]">
        {/* documents */}
        <nav className="rounded-xl border border-ink/10 p-3">
          <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Documents</h2>
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => openDoc(f)}
                  className={
                    doc?.path === f
                      ? "w-full truncate rounded px-2 py-1 text-left font-medium bg-cream"
                      : "w-full truncate rounded px-2 py-1 text-left hover:bg-cream/60"
                  }
                  title={f}
                >
                  {f.replace(/^builder\//, "")}
                </button>
              </li>
            ))}
            {files.length === 0 ? <li className="text-muted">No documents yet</li> : null}
          </ul>
        </nav>

        {/* preview */}
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
              <span className="text-muted">{doc ? "This document type previews in a later phase." : "Open a page document to preview it."}</span>
            </Centered>
          )}
        </main>

        {/* document JSON + validation */}
        <aside className="space-y-3">
          {doc ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-sm font-medium" title={doc.path}>{doc.path}</h2>
                <button type="button" onClick={saveDoc} className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream">
                  Save
                </button>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                className="h-[40vh] w-full rounded-xl border border-ink/10 bg-white/70 p-3 font-mono text-xs"
              />
              <div className="rounded-xl border border-ink/10 p-3">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Validation</h3>
                {issues.length === 0 ? (
                  <p className="text-sm text-muted">No issues — publishable ✓</p>
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
            <p className="text-sm text-muted">Select a document to inspect it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center p-6">{children}</div>;
}
