// ============================================================
// SOCIAL_CONSENT_PLATFORMS — opt-in list at checkout
// ============================================================
// Customer can opt-in to letting Lusik share a photo of the
// finished piece on social media. This is the platform list
// they pick from (subset of all platforms — only the ones we
// actually plan to share to).
//
// MIRRORED FROM index.html (~line 1933) during the Vite
// migration. After the flip (Phase 10), the index.html copy
// gets deleted and this becomes the single source of truth.
// ============================================================

export const SOCIAL_CONSENT_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok",    label: "TikTok" },
  { id: "facebook",  label: "Facebook" },
  { id: "youtube",   label: "YouTube" },
];
