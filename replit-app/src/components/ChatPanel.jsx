// ============================================================
// ChatPanel — "Text Lusik" (Chunk 7)
// ============================================================
// The JS sibling of ios/LusikSons/Views/ChatView.swift (itself the
// native sibling of the website's ChatAssistant): same welcome copy,
// same bubble layout, same optimistic-send-with-rollback behavior,
// backed by the same POST /chat Netlify Function. The transcript is
// in-memory only — closing the panel clears it. A per-install session
// id feeds the server's per-session daily cap.
//
// Chat is OFF server-side until Lusik sets ANTHROPIC_API_KEY (the
// function answers 503) — in that case this panel swaps the composer
// for the real channels (text + email), so it stays useful from day
// one. Portaled to <body> (full-attention surface above the island).

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sendChat, ChatOfflineError } from "../lib/api.js";
import { CONTACT, CHAT, smsHref, mailHref } from "../data/contact.js";

const SESSION_KEY = "ls_chat_session"; // the website's localStorage key

function sessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

export function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState([{ role: "assistant", content: CHAT.welcome }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [offline, setOffline] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setErrorText(null);
    const previous = messages;
    const outgoing = [...messages, { role: "user", content: trimmed }];
    setMessages(outgoing);
    setInput("");
    setSending(true);
    inputRef.current?.focus();
    try {
      const reply = await sendChat(outgoing, sessionId());
      setMessages([...outgoing, { role: "assistant", content: reply }]);
    } catch (err) {
      // Roll back the turn so a retry doesn't double it; keep the
      // guest's words unless they've already typed something new.
      setMessages(previous);
      setInput((cur) => (cur === "" ? trimmed : cur));
      if (err instanceof ChatOfflineError) setOffline(true);
      else setErrorText(err?.message || "Couldn't reach the assistant. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="chat" role="dialog" aria-label="Chat assistant">
      <div className="chat-header">
        <span className="chat-spark" aria-hidden="true">✦</span>
        <span className="chat-title brand-display">Lusik &amp; Sons</span>
        <span className="chat-ai">AI</span>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">✕</button>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "chat-bubble chat-user" : "chat-bubble chat-assistant"}>
            {m.content}
          </div>
        ))}
        {sending && <div className="chat-bubble chat-assistant chat-typing">● ● ●</div>}
        {errorText && <p className="chat-error" role="alert">{errorText}</p>}
      </div>

      {offline ? (
        <div className="chat-offline">
          <p className="chat-offline-title brand-display">The assistant isn't online yet.</p>
          <p className="chat-offline-sub">{CONTACT.subhead}</p>
          <a className="pill pill-ink" href={smsHref}>Text {CONTACT.phoneDisplay}</a>
          <a className="pill pill-outline" href={mailHref}>{CONTACT.email}</a>
        </div>
      ) : (
        <>
          <div className="chat-composer">
            <input
              ref={inputRef}
              type="text"
              value={input}
              placeholder={CHAT.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              aria-label="Type your message"
            />
            <button type="button" onClick={send} disabled={sending || !input.trim()} aria-label="Send message">
              ➤
            </button>
          </div>
          <p className="chat-disclaimer">AI-generated · Verify before relying</p>
        </>
      )}
    </div>,
    document.body
  );
}
