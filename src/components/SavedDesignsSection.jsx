"use client";

// ============================================================
// SavedDesignsSection — customer's design library
// ============================================================
// Up to 20 saved blanket configurations. Renders a small
// preview using BlanketLayoutPreview + a "use this design"
// button that hydrates the picker on the PDP.
//
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { Skeleton } from "./Skeleton.jsx";
import { BlanketLayoutPreview } from "./BlanketLayoutPreview.jsx";
import { useToast } from "./ToastProvider.jsx";
import { Trash2 } from "./icons.jsx";
import { resolveDesign } from "../lib/designUrl";

export function SavedDesignsSection({ userId, product }) {
  const toast = useToast();
  const [designs, setDesigns] = useState(null); // null = loading

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    db.listSavedDesigns().then(({ designs: d, error }) => {
      if (!mounted) return;
      if (error) { console.warn("listSavedDesigns:", error); setDesigns([]); return; }
      setDesigns(d);
    });
    return () => { mounted = false; };
  }, [userId]);

  const handleLoad = (entry) => {
    try {
      const encoded = btoa(JSON.stringify(entry.design));
      window.location.assign(`/?d=${encodeURIComponent(encoded)}#blanket`);
    } catch {
      toast({ kind: "error", message: "Couldn't load that design — please try again." });
    }
  };

  const handleDelete = async (entry) => {
    const { error } = await db.deleteSavedDesign(entry.id);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't delete that design." });
      return;
    }
    setDesigns((cur) => (cur ?? []).filter((d) => d.id !== entry.id));
    toast({ kind: "info", message: "Design removed." });
  };

  if (designs === null) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="p-3" style={{ border: "1px solid rgba(26,22,18,0.08)" }}>
            <Skeleton className="w-full mb-3" style={{ aspectRatio: "1 / 1" }} />
            <Skeleton className="w-3/4 h-3 mb-2" />
            <Skeleton className="w-1/2 h-3" />
          </div>
        ))}
      </div>
    );
  }

  if (designs.length === 0) {
    return (
      <p className="text-sm opacity-70 italic max-w-md leading-relaxed">
        Nothing saved yet. On the blanket page, click <span style={{ fontWeight: 500 }}>Save</span> next to the live preview to keep a configuration here for later.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {designs.map((entry) => {
        const r = resolveDesign(entry.design, product);
        const alphabet = r?.alphabet ?? product.alphabets[0];
        const layout   = r?.layout   ?? product.layouts.find((l) => l.enabled) ?? product.layouts[0];
        const blockHex = r?.blockColor?.hex  ?? "#999999";
        const letterHex = r?.letterColor?.hex ?? "#666666";
        const letterColors = r?.letterColorList ? r.letterColorList.map((c) => c.hex) : null;
        return (
          <div key={entry.id} className="p-3" style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
            <div className="overflow-hidden mb-3 flex items-center justify-center" style={{ background: "rgba(26,22,18,0.04)", aspectRatio: "1 / 1" }}>
              <BlanketLayoutPreview
                letters={alphabet.letters}
                layout={layout}
                darkMode={false}
                size={150}
                blockColor={blockHex}
                letterColor={letterHex}
                letterColors={letterColors}
                customLine1={r?.customLine1 ?? ""}
                customLine2={r?.customLine2 ?? ""}
                showCustomTextHints={false}
              />
            </div>
            <p className="text-sm leading-tight mb-1 truncate" style={{ fontWeight: 500 }} title={entry.label}>
              {entry.label}
            </p>
            <p className="text-[0.65rem] opacity-55 mb-3">
              Saved {new Date(entry.created_at).toLocaleDateString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleLoad(entry)}
                className="flex-1 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition hover:opacity-90"
                style={{ background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 500 }}
              >
                Open
              </button>
              <button
                onClick={() => handleDelete(entry)}
                className="px-3 py-2 opacity-70 hover:opacity-100 transition"
                style={{ border: "1px solid rgba(26,22,18,0.15)" }}
                aria-label={`Delete saved design ${entry.label}`}
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
