"use client";

// ============================================================
// MobileSearchBar — Apple Store-style floating search bar
// ============================================================
// Fixed-position pill that sits ABOVE the bottom tab bar when
// the Search view is active. Exactly mirrors the Apple Store's
// search-tab pattern: magnifying glass icon on the left, full-
// width input in the middle, microphone icon on the right.
//
// Font-size is 16px (1rem) — the minimum that prevents iOS
// Safari from auto-zooming the viewport when the input is
// focused. This is the single most important detail; anything
// under 16px triggers the zoom and makes the site look broken.
//
// The microphone button uses the Web Speech API
// (SpeechRecognition) to transcribe the customer's voice into
// the search query. When tapped it asks for microphone
// permission (browser-native prompt), listens for a phrase,
// and fills the input. Gracefully degrades: if the browser
// doesn't support SpeechRecognition, the mic icon is hidden.
//
// Position: fixed at the bottom, with a bottom offset that
// clears the tab bar + safe area. The search view's content
// has extra bottom padding to avoid being hidden behind this.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { Search, Mic } from "./icons.jsx";

const SR = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function MobileSearchBar({ query, onChange, visible }) {
  const inputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Auto-focus when the bar becomes visible (search tab opened).
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Clean up any active recognition on unmount.
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* silent */ }
    };
  }, []);

  const startVoice = () => {
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onChange?.(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoice = () => {
    try { recognitionRef.current?.stop(); } catch { /* silent */ }
    setListening(false);
  };

  if (!visible) return null;

  return (
    <div
      className="lg:hidden"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
        left: 12,
        right: 12,
        zIndex: 39,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: 50,
          borderRadius: 25,
          background: "rgba(245, 239, 227, 0.92)",
          border: "1px solid rgba(26, 22, 18, 0.12)",
          boxShadow: "0 4px 20px -4px rgba(26, 22, 18, 0.18)",
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
          overflow: "hidden",
          paddingLeft: 16,
          paddingRight: 6,
        }}
      >
        {/* Magnifying glass */}
        <span style={{ flexShrink: 0, color: "rgba(26, 22, 18, 0.4)" }}>
          <Search size={19} strokeWidth={1.6} />
        </span>

        {/* Input — 16px font prevents iOS zoom */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="What are you looking for?"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            flex: 1,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "16px",
            fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
            fontWeight: 400,
            color: "var(--text-primary, #1A1612)",
            paddingLeft: 10,
            paddingRight: 4,
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />

        {/* Clear button — only when there's text */}
        {query && (
          <button
            type="button"
            onClick={() => onChange?.("")}
            aria-label="Clear search"
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(26, 22, 18, 0.4)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "1.3rem", fontWeight: 300, lineHeight: 1 }}>&times;</span>
          </button>
        )}

        {/* Microphone — voice search via Web Speech API.
            Hidden entirely if the browser doesn't support it
            (graceful degradation). Turns gold when listening. */}
        {SR && (
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            aria-label={listening ? "Stop listening" : "Search by voice"}
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: listening
                ? "rgba(176, 136, 66, 0.15)"
                : "transparent",
              border: "none",
              cursor: "pointer",
              color: listening
                ? "#B08842"
                : "rgba(26, 22, 18, 0.35)",
              transition: "color 0.2s ease, background 0.2s ease",
            }}
          >
            <Mic size={20} strokeWidth={1.6} />
          </button>
        )}
      </div>
    </div>
  );
}
