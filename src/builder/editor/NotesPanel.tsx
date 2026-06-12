"use client";

// Review notes (INSPIRATION_ROADMAP P2) — margin notes pinned to blocks,
// stored as a gated document (builder/reviews/<slug>.json) so git is the
// collaboration transport: family members leave notes, history keeps them.
import { useCallback, useEffect, useState } from "react";
import { newId, reviewsSchema, type Reviews } from "../schema/index.ts";

type Api = (input: string, init?: RequestInit) => Promise<Response>;

export function NotesPanel({ api, slug, selectedBlockId, setStatus }: { api: Api; slug: string; selectedBlockId: string | null; setStatus: (s: string) => void }) {
  const path = `builder/reviews/${slug}.json`;
  const [doc, setDoc] = useState<Reviews | null>(null);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const res = await api(`/api/builder/docs?path=${encodeURIComponent(path)}`);
    if (res.status === 404) {
      setDoc({ schemaVersion: 1, slug, notes: [] });
      return;
    }
    if (!res.ok) return;
    const parsed = reviewsSchema.safeParse((await res.json()).content);
    if (parsed.success) setDoc(parsed.data);
  }, [api, path, slug]);

  useEffect(() => {
    setDoc(null);
    void load();
  }, [load]);

  const save = async (next: Reviews) => {
    const res = await api("/api/builder/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content: next, message: `review notes: ${slug}` }),
    });
    if (res.ok) setDoc(next);
    else setStatus((await res.json().catch(() => null))?.error || "Could not save the note");
  };

  if (!doc) return null;
  const open = doc.notes.filter((n) => !n.resolved);
  return (
    <details className="rounded-xl border border-ink/10 bg-white/50">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Notes {open.length > 0 ? <span className="ml-1 rounded-full bg-accent/15 px-1.5 text-[10px]">{open.length}</span> : null}
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {doc.notes.length === 0 ? <p className="text-xs text-muted">No notes yet — select a block and leave one for later (or for family).</p> : null}
        {doc.notes.map((n) => (
          <div key={n.id} className={n.resolved ? "rounded-lg border border-ink/10 p-2 opacity-50" : "rounded-lg border border-ink/10 p-2"}>
            <p className="text-xs">{n.text}</p>
            <p className="mt-1 flex items-center justify-between text-[10px] text-muted">
              <span>{n.author} · {new Date(n.createdAt).toLocaleDateString()}{n.blockId ? ` · on ${n.blockId.slice(0, 10)}…` : ""}</span>
              <button
                type="button"
                onClick={() => void save({ ...doc, notes: doc.notes.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x)) })}
                className="rounded-full border border-ink/20 px-2 py-0.5 hover:bg-cream"
              >
                {n.resolved ? "Reopen" : "Resolve ✓"}
              </button>
            </p>
          </div>
        ))}
        <div className="flex gap-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={selectedBlockId ? "Note on the selected block…" : "Note on this page…"}
            className="w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
            aria-label="New note"
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              const note = { id: newId("n"), blockId: selectedBlockId ?? undefined, author: "You", text: text.trim(), createdAt: Date.now() };
              setText("");
              void save({ ...doc, notes: [...doc.notes, note] });
            }}
            className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs text-cream disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </details>
  );
}
