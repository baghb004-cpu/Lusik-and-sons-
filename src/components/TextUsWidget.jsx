"use client";

// ============================================================
// TextUsWidget — fixed-position "Send us a text" floating widget
// ============================================================
// Detects whether the device can sms: (mobile) and offers
// either a tap-to-text flow OR a copy-the-number flow for
// desktops. The phone number itself lives in CONFIG.TEXT_US
// so it's the same string that the email composers use on the
// server.
//
// Includes its own copied-state timer with unmount-safe
// cleanup (capture-and-clear via useRef).
//
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import { CONFIG } from "../data/config.js";
import { Check, Copy, MessageCircle, X } from "./icons.jsx";

export function TextUsWidget() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Unmount-safe timer for the "Copied!" badge. See note on
  // justSavedTimerRef in ProductShowcase for the rationale.
  const copiedTimerRef = useRef(null);
  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }, []);

  // canSms is best-effort: we assume mobile-touch devices have an SMS app.
  // Wrong guesses are cheap because we always also show the phone number.
  // SSR-safe: start false (the server value) so the server render and the
  // client's first render agree, then read the real capability after mount.
  const [canSms, setCanSms] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setCanSms(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Track "is this a desktop visit." The expanded-by-default pill state and the
  // auto-collapse-on-idle behavior only run on desktop. Mobile users always
  // see the simple circular bubble.
  // Desktop = fine pointer + wide enough viewport that the expanded pill won't
  // crowd the layout. The 768px threshold matches Tailwind's md: breakpoint
  // used elsewhere on the site.
  //
  // SSR-safe: must start false so the server (which renders null below) and the
  // client's first render agree — reading matchMedia here would make the client
  // render the FAB while the server rendered nothing (React hydration error
  // #418). The effect below syncs the real value immediately after mount.
  const [isDesktop, setIsDesktop] = useState(false);

  // Listen for viewport size changes so a desktop user resizing into mobile
  // viewport (or rotating a tablet) gets the right widget shape.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine) and (min-width: 768px)");
    setIsDesktop(mq.matches); // sync the real value right after hydration
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // --- DESKTOP EXPANDED-PILL STATE ---
  // On desktop, the button starts as the wider "Need help? Let's chat." pill
  // after a short delay (so it doesn't pop in during initial page load and
  // distract from the hero). After 10s of no interaction, it auto-collapses
  // to a circle so the page corner isn't permanently blocked.
  const [pillExpanded, setPillExpanded] = useState(false);
  useEffect(() => {
    if (!isDesktop) { setPillExpanded(false); return; }
    if (open) return; // never compete with an open panel
    const expandTimer = setTimeout(() => setPillExpanded(true), 1800);
    return () => clearTimeout(expandTimer);
  }, [isDesktop, open]);

  useEffect(() => {
    if (!pillExpanded) return;
    const collapseTimer = setTimeout(() => setPillExpanded(false), 10000);
    return () => clearTimeout(collapseTimer);
  }, [pillExpanded]);

  // --- PROACTIVE BUBBLE ---
  // After a delay, a "Can we help you find something?" bubble pops up near
  // the button. Per-session: if the user dismisses it, it stays dismissed
  // for the rest of this visit. If they refresh tomorrow, it can re-pop.
  // (Session-scoped via sessionStorage; not persisted across visits.)
  const PROACTIVE_DELAY_MS = 45000;
  const [proactiveOpen, setProactiveOpen] = useState(false);
  // SSR-safe: start false on the server and the client's first render, then
  // read the per-session dismissal flag from sessionStorage after mount.
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lusik_proactive_dismissed_v1") === "1") {
        setProactiveDismissed(true);
      }
    } catch { /* sessionStorage blocked — leave as not-dismissed */ }
  }, []);

  useEffect(() => {
    if (proactiveDismissed) return;
    if (open) return; // don't pop while panel is already open
    const t = setTimeout(() => {
      // Re-check guards at fire time. If the user opened the panel between
      // delay-start and now, skip the proactive entirely.
      setProactiveOpen((curr) => {
        if (curr) return curr;
        return true;
      });
    }, PROACTIVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [open, proactiveDismissed]);

  // If the user opens the main panel, the proactive bubble is no longer needed.
  useEffect(() => {
    if (open && proactiveOpen) setProactiveOpen(false);
  }, [open, proactiveOpen]);

  const dismissProactive = () => {
    setProactiveOpen(false);
    setProactiveDismissed(true);
    try { sessionStorage.setItem("lusik_proactive_dismissed_v1", "1"); } catch {}
  };

  const proactiveYes = () => {
    setProactiveOpen(false);
    setProactiveDismissed(true);
    try { sessionStorage.setItem("lusik_proactive_dismissed_v1", "1"); } catch {}
    setOpen(true);
  };

  const cfg = CONFIG.TEXT_US;
  const smsHref = `sms:${cfg.phone_e164}${"?"}body=${encodeURIComponent(cfg.sms_prefill)}`;
  const telHref = `tel:${cfg.phone_e164}`;

  // Close on Escape so keyboard users can dismiss without hunting.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cfg.phone_display);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / iframe restrictions: silently ignore.
    }
  };

  // Show the expanded pill only when: desktop + idle expansion timer fired + panel closed.
  const showAsPill = isDesktop && pillExpanded && !open;

  // Desktop-only: the floating contact bubble is hidden on phones and
  // touch tablets. Mobile already has plenty of ways to reach Lusik
  // (the bottom-nav, the in-cart "Still have questions?" card, and the
  // Text/Call/Email/Video circles on Shop + product pages), so the
  // always-on bubble is reserved for big-screen mouse users. `isDesktop`
  // = (pointer: fine) AND (min-width: 768px), and it's reactive — a
  // desktop user who narrows the window drops the widget at the
  // breakpoint. Placed after every hook so the early return is safe.
  if (!isDesktop) return null;

  return (
    <>
      {/* PANEL */}
      {open && (
        <div className="textus-panel" role="dialog" aria-label="Text us">
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-3" style={{ borderBottom: "1px solid rgba(26,22,18,0.08)" }}>
            <div>
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#3D5A3D" }}>Direct line</p>
              <p className="font-display text-xl leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                {cfg.headline}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 -mt-1 -mr-1 opacity-50 hover:opacity-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 pt-4 space-y-4">
            <p className="text-sm opacity-80 leading-relaxed">
              {cfg.subhead}
            </p>

            {/* Primary CTA — opens SMS on mobile, copy-and-text on desktop */}
            {canSms ? (
              <a
                href={smsHref}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm tracking-[0.15em] uppercase transition"
                style={{ background: "#3D5A3D", color: "#F5EFE3" }}
                onClick={() => setOpen(false)}
              >
                <MessageCircle size={16} strokeWidth={1.5} />
                Text us now
              </a>
            ) : (
              <div className="space-y-3">
                <p className="text-xs opacity-60 leading-relaxed">
                  On your phone, tap below to start a text. On desktop, copy our number and text from your phone.
                </p>
                <div className="flex items-stretch gap-2">
                  <a
                    href={telHref}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-display"
                    style={{ background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 500 }}
                  >
                    {cfg.phone_display}
                  </a>
                  <button
                    onClick={handleCopy}
                    className="px-3 flex items-center justify-center transition"
                    style={{ border: "1px solid rgba(26,22,18,0.2)", background: copied ? "rgba(61,90,61,0.1)" : "transparent" }}
                    aria-label={copied ? "Copied" : "Copy number"}
                    data-tooltip={copied ? "Copied to clipboard" : "Copy phone number"}
                    data-tooltip-pos="top"
                  >
                    {copied ? <Check size={16} strokeWidth={1.75} style={{ color: "#3D5A3D" }} /> : <Copy size={16} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            )}

            {/* Secondary: prefer voice */}
            <div className="text-xs opacity-60 text-center pt-1">
              Prefer to call? <a href={telHref} className="underline hover:opacity-100">{cfg.phone_display}</a>
            </div>
          </div>

          {/* Footer privacy reassurance — small, but matters for mobile-first users */}
          <div className="px-5 py-3 text-[0.65rem] opacity-50 text-center leading-relaxed" style={{ background: "rgba(176,136,66,0.06)" }}>
            Standard message rates apply · We never share your number
          </div>
        </div>
      )}

      {/* PROACTIVE BUBBLE — appears after PROACTIVE_DELAY_MS, until dismissed for this session */}
      {proactiveOpen && !open && (
        <div className="textus-proactive" role="dialog" aria-label="Can we help you find something?">
          <div className="p-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base leading-tight mb-1" style={{ fontWeight: 500 }}>
                Can we help you find something?
              </p>
              <p className="text-xs opacity-60 leading-relaxed">
                Lusik usually replies within a day.
              </p>
            </div>
            <button
              onClick={dismissProactive}
              className="p-0.5 -mt-0.5 -mr-0.5 opacity-40 hover:opacity-80 shrink-0"
              aria-label="Close suggestion"
              data-tooltip="Dismiss"
              data-tooltip-pos="left"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            <button
              onClick={proactiveYes}
              className="px-3 py-2 text-xs tracking-[0.15em] uppercase transition"
              style={{ background: "#3D5A3D", color: "#F5EFE3" }}
            >
              Chat now
            </button>
            <button
              onClick={dismissProactive}
              className="px-3 py-2 text-xs tracking-[0.15em] uppercase opacity-70 hover:opacity-100 transition"
              style={{ border: "1px solid rgba(26,22,18,0.18)" }}
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {/* FAB — circle on mobile, expanded pill on desktop after first idle */}
      <button
        className={`textus-fab${showAsPill ? " expanded" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close text us panel" : "Open text us panel"}
        aria-expanded={open}
      >
        {open ? (
          <X size={22} strokeWidth={2} />
        ) : (
          <>
            <MessageCircle size={showAsPill ? 20 : 24} strokeWidth={1.75} />
            {showAsPill && <span className="textus-fab-label">Need help? Let's chat.</span>}
          </>
        )}
      </button>
    </>
  );
}
