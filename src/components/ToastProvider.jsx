"use client";

// ============================================================
// ToastProvider + useToast + ToastViewport
// ============================================================
// Undo-toast infrastructure. Components call useToast() to get
// a push() function; calling it with { message, kind, action }
// shows a slide-in toast at the bottom of the viewport that
// either auto-dismisses on its own duration timer OR sticks
// until the user dismisses.
//
//   const toast = useToast();
//   toast({ kind: "success", message: "Saved." });
//   toast({
//     message: "Removed from cart.",
//     action: { label: "Undo", onClick: () => addBack() },
//   });
//   toast({ kind: "error", message: "Couldn't save." });
//
// Kinds: "info" (default), "success", "error". Errors get a
// longer duration (6s) and role="alert" for screen readers.
//
// ============================================================

import React, { useState, useRef, useEffect, useCallback, useContext } from "react";

const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    // Tag the toast as leaving so the CSS plays the slide-out,
    // then drop it from state after the animation. 220ms matches
    // the toast-out keyframe duration.
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    const leaveTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 220);
    timers.current.set(`leave-${id}`, leaveTimer);
  }, []);

  const push = useCallback((opts) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const t = {
      id,
      kind:     opts.kind     ?? "info",
      message:  opts.message  ?? "",
      action:   opts.action   ?? null,
      duration: opts.duration ?? (opts.kind === "error" ? 6000 : 3800),
      leaving:  false,
    };
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) {
      const dismissTimer = setTimeout(() => dismiss(id), t.duration);
      timers.current.set(id, dismissTimer);
    }
    return id;
  }, [dismiss]);

  // Clean up any pending timers on unmount so toasts don't try to
  // dismiss after the provider is gone.
  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// useToast — returns a function. Calling it with no args is safe
// (no-op fallback) so components don't crash if they're somehow
// rendered outside the provider.
export function useToast() {
  const push = useContext(ToastContext);
  return push ?? (() => {});
}

// Visual rendering — one viewport, N toasts. The viewport is
// aria-live polite by default; error toasts get aria-live assertive
// via their own role="alert". Each toast has an X close button so
// keyboard users can dismiss without waiting for the timer.
function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  // Visual treatment per kind. Background stays cream-ish so
  // toasts feel part of the brand, not a system overlay. The
  // accent comes from a 3px left border in the kind's color.
  const styleFor = (kind) => {
    if (kind === "error")   return { borderLeftColor: "#8B2C2C", iconColor: "#8B2C2C", role: "alert"  };
    if (kind === "success") return { borderLeftColor: "var(--accent)", iconColor: "var(--accent)", role: "status" };
    return                         { borderLeftColor: "rgba(26,22,18,0.35)", iconColor: "#1A1612", role: "status" };
  };

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const s = styleFor(t.kind);
        return (
          <div
            key={t.id}
            role={s.role}
            className={`toast-item ${t.leaving ? "toast-leave" : ""}`}
            onClick={(e) => {
              // Don't dismiss when the customer clicked the action button.
              if (e.target.closest && e.target.closest("[data-toast-action]")) return;
              onDismiss(t.id);
            }}
          >
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer shadow-sm"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                borderLeft: `3px solid ${s.borderLeftColor}`,
                border: "1px solid var(--border-default)",
                borderLeftWidth: "3px",
                borderLeftColor: s.borderLeftColor,
              }}
            >
              {/* Subtle dot icon — keeps the toast clean without leaning on emoji */}
              <span
                aria-hidden="true"
                className="mt-1.5 flex-shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: s.iconColor }}
              />
              <div className="flex-1 text-sm leading-snug" style={{ fontWeight: 500 }}>
                {t.message}
              </div>
              {t.action && (
                <button
                  data-toast-action
                  onClick={(e) => {
                    e.stopPropagation();
                    try { t.action.onClick?.(); } finally { onDismiss(t.id); }
                  }}
                  className="text-xs tracking-[0.15em] uppercase px-2 py-1 flex-shrink-0"
                  style={{ color: s.iconColor, fontWeight: 600 }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                aria-label="Dismiss notification"
                onClick={(e) => { e.stopPropagation(); onDismiss(t.id); }}
                className="text-xs opacity-50 hover:opacity-90 flex-shrink-0 px-1"
                style={{ lineHeight: 1 }}
              >×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
