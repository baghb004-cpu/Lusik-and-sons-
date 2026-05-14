// ============================================================
// ChatAssistant — off-by-default floating chat
// ============================================================
// Backed by netlify/functions/chat.mjs (which talks to the
// Anthropic API). Disabled unless CONFIG.PAID_FEATURES.
// CHAT_ASSISTANT.ENABLED is true AND ANTHROPIC_API_KEY is set
// server-side.
//
// Conversation history is held in memory only (refresh clears).
// The function caps per-IP + per-session turns so a single bad
// actor can't run up the bill.
//
// MIRRORED FROM index.html (~line 4704).
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import { CONFIG } from "../data/config.js";
import { track } from "../lib/analytics.js";
import { X, Send, Sparkles } from "./icons.jsx";

export function ChatAssistant() {
  const cfg = CONFIG.PAID_FEATURES?.CHAT_ASSISTANT;
  // Short-circuit before any state hooks so this is literally
  // zero-cost when the feature is off — no listeners, no DOM.
  if (!cfg?.ENABLED) return null;

  const [open, setOpen] = useState(false);
  // Conversation history is held in memory only — refresh clears
  // it. If we wanted persistence we'd stash it in localStorage,
  // but ephemeral feels right for a chat-with-the-shop pattern.
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  // Per-tab session id, used by the server-side rate limiter.
  // localStorage so the per-day cap survives the user closing
  // and reopening the chat panel without losing their slot.
  const sessionIdRef = useRef(null);
  useEffect(() => {
    try {
      let id = localStorage.getItem("ls_chat_session");
      if (!id) {
        id = (crypto.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        localStorage.setItem("ls_chat_session", id);
      }
      sessionIdRef.current = id;
    } catch { sessionIdRef.current = `s_${Date.now()}`; }
  }, []);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError("");
    const next = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`${CONFIG.FN_BASE}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: next, sessionId: sessionIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "The assistant is having trouble right now.");
        // Roll back the user turn so they can retry without it
        // counting twice in the visible history.
        setMessages(messages);
        setInput(trimmed);
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply || "" }]);
      track("chat-message", { turnsUsed: data.turnsUsed });
    } catch {
      setError("Couldn't reach the assistant. Please try again.");
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          if (messages.length === 0 && cfg.WELCOME) {
            setMessages([{ role: "assistant", content: cfg.WELCOME }]);
          }
        }}
        className="fixed bottom-6 left-6 z-40 px-4 py-3 flex items-center gap-2 shadow-lg transition hover:opacity-90 chat-fab"
        style={{
          background: "var(--ink)",
          color: "var(--text-on-ink)",
          fontSize: "0.7rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
        aria-label="Open chat assistant"
      >
        <Sparkles size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">{cfg.LAUNCHER_LABEL || "Ask us anything"}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-40 flex flex-col chat-panel theme-surface"
      style={{
        width: "min(360px, calc(100vw - 3rem))",
        height: "min(560px, calc(100vh - 8rem))",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      }}
      role="dialog"
      aria-label="Chat assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          <span className="font-display text-sm" style={{ fontWeight: 500 }}>Lusik & Sons</span>
          <span className="text-[0.55rem] tracking-[0.2em] uppercase opacity-55">AI</span>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="opacity-60 hover:opacity-100 transition">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: "var(--bg-page)" }}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="px-3 py-2 text-sm max-w-[85%]"
              style={{
                background: m.role === "user" ? "var(--ink)" : "var(--bg-surface)",
                color:      m.role === "user" ? "var(--text-on-ink)" : "var(--text-primary)",
                border:     m.role === "user" ? "none" : "1px solid var(--border-default)",
                borderRadius: 12,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="px-3 py-2 text-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, color: "var(--text-muted)" }}>
              <span className="chat-typing">●●●</span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs italic" style={{ color: "var(--error)" }}>{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={cfg.PLACEHOLDER || "Type your question…"}
          disabled={sending}
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--bg-page)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
          aria-label="Type your message"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-2 transition"
          style={{
            background: "var(--ink)",
            color: "var(--text-on-ink)",
            opacity: sending || !input.trim() ? 0.4 : 1,
          }}
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-3 py-1.5 text-[0.55rem] tracking-[0.15em] uppercase opacity-50 text-center" style={{ borderTop: "1px solid var(--border-soft)" }}>
        AI-generated · Verify before relying
      </div>
    </div>
  );
}
