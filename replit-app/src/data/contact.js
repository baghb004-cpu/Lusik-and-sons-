// ============================================================
// Contact + chat strings — the JS mirror of the web CONFIG.TEXT_US
// and CONFIG.PAID_FEATURES.CHAT_ASSISTANT (and the iOS
// Contact.swift / ChatConfig). One source of truth for the phone +
// email the app shows — the exact strings the website and the
// server's order emails use. Change values here, never inline.
// ============================================================

export const CONTACT = {
  phoneE164: "+17608742333",
  phoneDisplay: "(760) 874-2333",
  smsPrefill: "Hi Lusik & Sons — ",
  email: "hello@lusikandsons.com",
  headline: "Send us a text.",
  subhead: "Lusik or one of her sons writes back, usually within a day.",
};

export const smsHref = `sms:${CONTACT.phoneE164}?body=${encodeURIComponent(CONTACT.smsPrefill)}`;
export const mailHref = `mailto:${CONTACT.email}`;

/** Whether chat is LIVE is the server's call (the /chat Function
 *  answers 503 until ANTHROPIC_API_KEY is set); these are UI strings. */
export const CHAT = {
  launcherLabel: "Ask us anything",
  welcome:
    "Hello — I'm the Lusik & Sons assistant. Ask me about the alphabet blanket, the bibs, the towels, the colors Lusik works in, shipping, sizing, anything. If a question is best for Lusik herself, I'll tell you that too.",
  placeholder: "Type your question…",
};
