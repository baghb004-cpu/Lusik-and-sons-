// ============================================================
// Communication Coach — privacy + consent copy (single source)
// ============================================================
// One place for the honest disclosures the UI must show before any
// microphone use. The mechanism is described truthfully: it listens
// to ROOM audio, never connects to the call, never records secretly.
// ============================================================

export const MIC_DISCLOSURE =
  "Microphone Assist listens to nearby audio through your device microphone. It does not connect directly to the phone call. Use speakerphone, get permission when required, and choose whether to save notes. Audio is not saved by default.";

export const MIC_RULES = [
  "It always asks permission before using the microphone.",
  "It never listens or records secretly — a clear indicator shows when the mic is on.",
  "It listens to room audio (the speakerphone), not the call itself.",
  "Audio is not saved by default; only optional text notes you choose to keep.",
  "Follow your local laws and get permission when recording is involved.",
];

export const INTERVIEW_HONESTY_NOTE =
  "Interview Coach is for practice and preparation only. It is never for secret help, hidden answers, or anything during a real interview. The goal is to present your real strengths honestly and clearly.";

export const OUTREACH_HONESTY_NOTE =
  "This coach helps you speak honestly and politely. It will never help you pressure people, over-promise, or make false claims. A respectful 'no' is always a fine outcome.";

export const DATA_NOTE =
  "Everything here stays on this device (saved in your browser). Nothing is uploaded. You can export your notes and trackers to a file, or clear them anytime in Settings.";
