// For You — the brand front door (placeholder until the home content
// ports; the contact cluster is live, mirroring the iOS ForYouView).
// Chunk 7 wired the "Ask us anything" launcher to the real ChatPanel
// and moved the contact strings to data/contact.js (shared with chat).

import React, { useState } from "react";
import { CONTACT, CHAT, smsHref, mailHref } from "../data/contact.js";
import { ChatPanel } from "../components/ChatPanel.jsx";

export function ForYou() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="placeholder-panel readable">
      <h1 className="brand-display" style={{ fontSize: 40, fontWeight: 500, margin: 0 }}>
        Lusik &amp; Sons
      </h1>
      <p style={{ fontSize: 15, opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
        Hand cross-stitched Armenian heirlooms,
        <br />
        made one at a time in Southern California.
      </p>

      <div style={{ marginTop: 40 }}>
        <h2 className="brand-display" style={{ fontSize: 19, fontWeight: 500, margin: 0 }}>
          {CONTACT.headline}
        </h2>
        <p style={{ fontSize: 13, opacity: 0.65, margin: "6px 0 0" }}>{CONTACT.subhead}</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <a className="pill pill-ink" href={smsHref}>
          Text us
        </a>
        <a className="pill pill-outline" href={mailHref}>
          Email Lusik
        </a>
        <button type="button" className="pill pill-outline" onClick={() => setChatOpen(true)}>
          ✦ {CHAT.launcherLabel}
        </button>
      </div>

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  );
}
