// ============================================================
// useFocusTrap — the focus contract aria-modal="true" promises
// ============================================================
// Every dialog in the app declares aria-modal="true", which tells
// assistive tech the rest of the page doesn't exist — so the dialog
// MUST take focus on open, keep Tab cycling inside itself, and give
// focus back to the opener on close. Nothing in the repo did any of
// that (the opener kept focus on an element AT hidden from the tree).
//
// Usage:
//   const ref = useFocusTrap<HTMLDivElement>(isOpen);
//   <div ref={ref} role="dialog" aria-modal="true" ...>
//
// For always-mounted-when-rendered dialogs (mounted only while open),
// pass `true`. On open: focuses the first focusable descendant (or the
// container). While open: Tab/Shift+Tab wrap inside. On unmount/close:
// restores focus to whatever had it before the dialog opened.
// ============================================================

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean = true) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const opener = document.activeElement as HTMLElement | null;

    // Move focus in. Prefer a real control (autoFocus inputs win by being
    // focused already); fall back to the container itself.
    const alreadyInside = container.contains(document.activeElement);
    if (!alreadyInside) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus();
      else {
        container.tabIndex = -1;
        container.focus();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !container.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Restore focus to the opener — only if focus is still inside the
      // (now-closing) dialog or lost to <body>; if the user already moved
      // focus somewhere real, leave it alone.
      const current = document.activeElement;
      if (
        opener &&
        opener.isConnected &&
        (current === null || current === document.body || container.contains(current))
      ) {
        opener.focus();
      }
    };
  }, [active]);

  return containerRef;
}
