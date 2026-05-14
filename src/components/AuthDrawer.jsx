// ============================================================
// AuthDrawer — sign-in / sign-up / password reset
// ============================================================
// Three modes in one drawer: signin, signup, forgot. Uses our
// `auth` wrapper instead of touching window.netlifyIdentity
// directly — that's the chokepoint for retries + error shape.
//
// MIRRORED FROM index.html (~line 6804).
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { auth } from "../lib/auth.js";
import { ArrowRight, Eye, EyeOff, X } from "./icons.jsx";

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(26,22,18,0.4)" }} />
      <div
        className="relative w-full max-w-md drawer-in flex flex-col overflow-y-auto"
        style={{ background: "var(--bg-page)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 lg:p-8 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>{t.eyebrow}</p>
            <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              {t.heading[0]} <em style={{ fontWeight: 400 }}>{t.heading[1]}</em>.
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-60 -mt-1 -mr-1" aria-label="Close" data-tooltip="Close" data-tooltip-pos="left">
            <X size={22} />
          </button>
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
            {busy ? "Working…" : (
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
      </div>
    </div>
  );
}
