"use client";

// ============================================================
// AuthDrawer — sign-in / sign-up / password reset
// ============================================================
// Three modes in one drawer: signin, signup, forgot. Uses our
// `auth` wrapper instead of touching window.netlifyIdentity
// directly — that's the chokepoint for retries + error shape.
//
// Swipe-to-close: the drawer supports rightward swipe-to-dismiss
// on touch devices, matching the cart drawer's gesture. Uses the
// same CONFIG.SWIPE tunables so both drawers feel identical.
//
// "Breathing peek" hint: on mount, after a 600ms delay (enough
// for the slide-in animation to finish), the drawer nudges 20px
// to the right and springs back. This single micro-animation
// teaches the user "I'm dismissible by swiping this direction"
// without text or arrows — the same pattern iOS uses for bottom
// sheets and lock-screen shortcuts. Fires once per session
// (sessionStorage gate), honors prefers-reduced-motion.
//
// MIRRORED FROM index.html (~line 6804).
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "../lib/auth.js";
import { CONFIG } from "../data/config.js";
import { ArrowRight, Eye, EyeOff, X } from "./icons.jsx";
import { BottomSheet } from "./BottomSheet.jsx";

// Session-level gate so the peek fires at most once. Using a
// module-level variable instead of sessionStorage avoids a
// read on every render — the module lives for the tab's lifetime,
// same as sessionStorage, so the behavior is identical.
let peekFiredThisSession = false;

export function AuthDrawer({ onClose, onAuthed }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(""); // success/info message (e.g. "Check your email")

  // --- SWIPE-TO-DISMISS STATE ---
  // Mirrors the cart drawer's swipe logic in App.jsx: track a
  // horizontal drag, dismiss past DISMISS_THRESHOLD_PX, spring
  // back otherwise. Touch-only — mouse users have the X button
  // and the backdrop click.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);
  const dragIntentRef = useRef(null); // null | "horizontal" | "vertical"

  // --- "BREATHING PEEK" HINT STATE ---
  // peekOffset controls the translateX during the hint. 0 at rest,
  // 20 during the outward nudge, 0 again on the return spring.
  // peekTransition controls the CSS transition for the peek
  // independently of the drag transition.
  const [peekOffset, setPeekOffset] = useState(0);
  const [peekTransition, setPeekTransition] = useState("none");

  useEffect(() => {
    if (peekFiredThisSession) return;

    // Honor reduced motion — skip the animation entirely.
    const reducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      peekFiredThisSession = true;
      return;
    }

    // Wait 600ms for the drawer's slide-in to finish, then nudge.
    const t1 = setTimeout(() => {
      peekFiredThisSession = true;
      // Outward nudge — fast ease-out
      setPeekTransition("transform 0.15s ease-out");
      setPeekOffset(20);

      // Spring back — uses a spring-like cubic-bezier
      const t2 = setTimeout(() => {
        setPeekTransition("transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)");
        setPeekOffset(0);

        // Clear the transition so it doesn't interfere with drag
        const t3 = setTimeout(() => {
          setPeekTransition("none");
        }, 420);
        // Store t3 for cleanup if unmounted mid-animation.
        cleanupTimers.current.push(t3);
      }, 160);
      cleanupTimers.current.push(t2);
    }, 600);

    const cleanupTimers = { current: [t1] };
    return () => {
      cleanupTimers.current.forEach(clearTimeout);
    };
  }, []);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    if (!t) return;
    dragStartRef.current = { x: t.clientX, y: t.clientY };
    dragIntentRef.current = null;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragStartRef.current) return;
    // Bail on multi-touch (pinch should not trigger swipe).
    if (e.touches.length > 1) {
      onTouchCancel();
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;

    if (dragIntentRef.current === null) {
      if (Math.abs(dx) < CONFIG.SWIPE.CLAIM_DIST_PX && Math.abs(dy) < CONFIG.SWIPE.CLAIM_DIST_PX) return;
      dragIntentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (dragIntentRef.current !== "horizontal") return;
    // Only react to rightward drag (positive dx). Leftward swipes
    // should be ignored — the drawer opens from the right edge.
    setDragging(true);
    setDragX(Math.max(0, dx));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragIntentRef.current === "horizontal") {
      setDragging(false);
      if (dragX > CONFIG.SWIPE.DISMISS_THRESHOLD_PX) {
        // Dismiss — slide off-screen then call onClose.
        setDragX(window.innerWidth);
        setTimeout(() => onClose(), CONFIG.SWIPE.COMMIT_ANIM_MS);
      } else {
        // Spring back to 0.
        setDragX(0);
      }
    }
    dragStartRef.current = null;
    dragIntentRef.current = null;
  }, [dragX, onClose]);

  const onTouchCancel = useCallback(() => {
    setDragging(false);
    setDragX(0);
    dragStartRef.current = null;
    dragIntentRef.current = null;
  }, []);

  const reset = (newMode) => {
    setMode(newMode);
    setError("");
    setInfo("");
    setPassword("");
  };

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        if (!password) { setError("Please enter your password."); return; }
        const { error } = await auth.signIn({ email, password });
        if (error) {
          setError(error.message || "Sign in failed.");
          return;
        }
        onAuthed();
        return;
      }

      if (mode === "signup") {
        if (!fullName.trim()) { setError("Please enter your full name."); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
        const { error } = await auth.signUp({
          email,
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
        });
        if (error) {
          setError(error.message || "Sign up failed.");
          return;
        }
        // Netlify Identity sends a confirmation email on signup by default
        // (configurable in Site → Identity → Registration). Until the user
        // clicks the link, login will fail; surface that expectation now.
        setInfo("Almost there! We've sent you a confirmation email — click the link to finish setting up your account.");
        setPassword("");
        return;
      }

      if (mode === "forgot") {
        const { error } = await auth.sendPasswordReset(email);
        if (error) {
          setError(error.message || "Couldn't send reset email.");
          return;
        }
        setInfo("If that email is registered with us, a reset link is on its way.");
        return;
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    signin:  { eyebrow: "Welcome back",   heading: ["Sign", "in"] },
    signup:  { eyebrow: "First time here", heading: ["Make an", "account"] },
    forgot:  { eyebrow: "Forgot password", heading: ["Reset", "it"] },
  };
  const t = titles[mode];

  // Reusable input class — matches the rest of the site's restrained styling.
  const inputCls = "w-full px-4 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]";
  const inputStyle = { border: "1px solid rgba(26,22,18,0.15)" };

  // Compute the combined translateX: drag takes priority over peek.
  // When dragging, the peek offset is irrelevant (the finger owns
  // the position). When idle, the peek offset animates the hint.
  const translateX = dragging || dragX > 0 ? dragX : peekOffset;
  const transition = dragging
    ? "none"
    : dragX > 0
      ? "transform 0.2s ease-out"
      : peekTransition !== "none"
        ? peekTransition
        : "transform 0.2s ease-out";

  const isMobile = typeof window !== "undefined"
    && window.matchMedia?.("(max-width: 1023px)").matches;

  // Header + form — shared between the desktop right-edge drawer and the
  // mobile bottom sheet (which supplies its own grabber + white X, so the
  // header's own close button is hidden on mobile).
  const body = (
    <>
        {/* Header */}
        <div className="flex items-start justify-between p-6 lg:p-8 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>{t.eyebrow}</p>
            <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              {t.heading[0]} <em style={{ fontWeight: 400 }}>{t.heading[1]}</em>.
            </h2>
          </div>
          {!isMobile && (
            <button onClick={onClose} className="p-1 hover:opacity-60 -mt-1 -mr-1" aria-label="Close" data-tooltip="Close" data-tooltip-pos="left">
              <X size={22} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-5 flex-1">
          {/* Sign-up extras: full name + phone */}
          {mode === "signup" && (
            <>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5">Full name</label>
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  required autoComplete="name"
                  className={inputCls} style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5">Phone <span className="opacity-50 normal-case tracking-normal text-[0.65rem] ml-1">(optional)</span></label>
                <input
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className={inputCls} style={inputStyle}
                />
              </div>
            </>
          )}

          {/* Email — always shown */}
          <div>
            <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              required
              className={inputCls} style={inputStyle}
            />
          </div>

          {/* Password — hidden in forgot-password mode */}
          {mode !== "forgot" && (
            <div>
              <label className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-1.5 flex items-center justify-between">
                <span>Password</span>
                {mode === "signin" && (
                  <button type="button" onClick={() => reset("forgot")} className="text-[0.65rem] tracking-normal normal-case underline opacity-70 hover:opacity-100">Forgot?</button>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  className={inputCls + " pr-10"} style={inputStyle}
                />
                <button
                  type="button" onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  data-tooltip={showPassword ? "Hide password" : "Show password"}
                  data-tooltip-pos="left"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === "signup" && <p className="text-[0.65rem] opacity-60 mt-1.5">At least 8 characters.</p>}
            </div>
          )}

          {/* Status messages */}
          {error && (
            <div className="text-sm p-3" style={{ background: "rgba(139,44,44,0.08)", border: "1px solid rgba(139,44,44,0.25)", color: "#8B2C2C" }}>
              {error}
            </div>
          )}
          {info && (
            <div className="text-sm p-3 leading-relaxed" style={{ background: "rgba(176,136,66,0.1)", border: "1px solid rgba(176,136,66,0.3)" }}>
              {info}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={busy}
            className="w-full py-3 text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
            style={{
              background: busy ? "rgba(26,22,18,0.5)" : "#1A1612",
              color: "#F5EFE3",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Working..." : (
              mode === "signin" ? "Sign in" :
              mode === "signup" ? "Create account" :
              "Email me a reset link"
            )}
            {!busy && <ArrowRight size={14} strokeWidth={1.5} />}
          </button>

          {/* Mode switcher */}
          <div className="text-center pt-2">
            {mode === "signin" && (
              <p className="text-sm opacity-70">
                New here?{" "}
                <button type="button" onClick={() => reset("signup")} className="underline hover:opacity-60">Make an account</button>
              </p>
            )}
            {mode === "signup" && (
              <p className="text-sm opacity-70">
                Already have an account?{" "}
                <button type="button" onClick={() => reset("signin")} className="underline hover:opacity-60">Sign in</button>
              </p>
            )}
            {mode === "forgot" && (
              <p className="text-sm opacity-70">
                <button type="button" onClick={() => reset("signin")} className="underline hover:opacity-60">Back to sign in</button>
              </p>
            )}
          </div>

          {/* Tagline */}
          <p className="text-xs opacity-50 text-center pt-4 leading-relaxed font-display italic" style={{ fontWeight: 400 }}>
            Your account saves your cart and keeps a record of every blanket Lusik makes for you.
          </p>
        </form>
    </>
  );

  // Mobile → rise from the bottom as a swipe-dismissable sheet (matching
  // the account sheet). Desktop → the original right-edge drawer with its
  // horizontal swipe-to-dismiss + breathing peek.
  if (isMobile) {
    return (
      <BottomSheet open onClose={onClose} ariaLabel={t.eyebrow} peekKey="auth">
        {body}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 lg-scrim" />
      <div
        className="lg-panel-tall lg-drawer relative w-full max-w-md drawer-in flex flex-col overflow-y-auto"
        style={{
          transform: `translateX(${translateX}px)`,
          transition,
          touchAction: "pan-y",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {body}
      </div>
    </div>
  );
}
