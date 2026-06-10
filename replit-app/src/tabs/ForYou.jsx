// For You — the brand front door (placeholder until the home content
// ports; the contact cluster is live, mirroring the iOS ForYouView).

import React from "react";

// CONFIG.TEXT_US mirror — same strings as the website + iOS Contact.swift.
const CONTACT = {
  phoneE164: "+17608742333",
  phoneDisplay: "(760) 874-2333",
  smsPrefill: "Hi Lusik & Sons — ",
  email: "hello@lusikandsons.com",
  headline: "Send us a text.",
  subhead: "Lusik or one of her sons writes back, usually within a day.",
};

export function ForYou() {
  const smsHref = `sms:${CONTACT.phoneE164}?body=${encodeURIComponent(CONTACT.smsPrefill)}`;

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

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <a className="pill pill-ink" href={smsHref}>
          Text us
        </a>
        <a className="pill pill-outline" href={`mailto:${CONTACT.email}`}>
          Email Lusik
        </a>
      </div>

      <p style={{ fontSize: 11, opacity: 0.45, marginTop: 18 }}>
        The "Ask us anything" assistant arrives with Chunk 7.
      </p>
    </div>
  );
}
