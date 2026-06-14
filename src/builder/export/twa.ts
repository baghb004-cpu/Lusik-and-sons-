// ============================================================
// Export — Android TWA scaffold (App Developer Mode, plan §22)
// ============================================================
// The honest Android path: a Trusted Web Activity wraps the PWA
// export in a real, Play-Store-accepted Android app. Unlike the
// iOS path it compiles ANYWHERE (Bubblewrap brings its own JDK +
// Android SDK) — no Mac, no Windows requirement.
//
// We generate Bubblewrap's config (twa-manifest.json) + an honest
// step-by-step README. The APK/AAB build itself runs on the
// user's machine with `bubblewrap build` — generating binaries is
// not something a JSON file can do, and we say so.
// ============================================================

import type { Theme } from "../schema/index.ts";

function packageIdFrom(host: string): string {
  const parts = host
    .replace(/^www\./, "")
    .split(".")
    .reverse()
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, "").replace(/^(\d)/, "n$1") || "app");
  return parts.join(".") || "com.example.app";
}

export function buildTwaManifest(input: { siteName: string; webBaseURL: string; theme: Theme | null }): string {
  const url = new URL(input.webBaseURL);
  const themeColor = input.theme?.tokens.colors.ink ?? "#1A1612";
  const backgroundColor = input.theme?.tokens.colors.cream ?? "#F5EFE3";
  return JSON.stringify(
    {
      packageId: packageIdFrom(url.host),
      host: url.host,
      name: input.siteName,
      launcherName: input.siteName.length > 12 ? input.siteName.split(/[\s—-]/)[0] : input.siteName,
      display: "standalone",
      themeColor,
      navigationColor: themeColor,
      backgroundColor,
      startUrl: "/",
      iconUrl: `${url.origin}/icons/icon-512.png`,
      maskableIconUrl: `${url.origin}/icons/icon-maskable-512.png`,
      orientation: "portrait",
      fallbackType: "customtabs",
      enableNotifications: false,
      // signingKey is created by `bubblewrap build` on first run
      appVersionName: "1.0.0",
      appVersionCode: 1,
      shortcuts: [],
      generatorApp: "baghdos-workshop",
      webManifestUrl: `${url.origin}/manifest.webmanifest`,
    },
    null,
    2
  );
}

export function buildAndroidReadme(siteName: string, webBaseURL: string): string {
  return `# ${siteName} — Android app (Trusted Web Activity)

This folder turns your deployed PWA into a real Android app the Play
Store accepts. Unlike the iOS path, **everything here runs on Windows,
Linux or Mac** — no special hardware.

## One-time setup
1. Deploy the PWA export so it's live at **${webBaseURL}** (the TWA wraps
   the LIVE site, not local files).
2. Install Node 18+ and run: \`npm i -g @bubblewrap/cli\`
   (first run offers to download the JDK + Android SDK for you — say yes).

## Build it
\`\`\`
bubblewrap init --manifest ${webBaseURL.replace(/\/$/, "")}/manifest.webmanifest
# …or skip init and use the twa-manifest.json beside this file
bubblewrap build
\`\`\`
That produces \`app-release-signed.apk\` (sideload/test) and an \`.aab\`
(what the Play Store wants). Keep the generated signing key safe — Play
updates must use the same key.

## Make Android trust the site (required)
\`bubblewrap build\` prints a **Digital Asset Links** JSON (your app's
SHA-256 fingerprint). Serve it at:
\`${webBaseURL.replace(/\/$/, "")}/.well-known/assetlinks.json\`
Without it the app shows a browser bar instead of running full-screen.

## Play Store
- One-time $25 Google Play developer account.
- Upload the .aab, fill the listing (the App Developer Mode checklist in
  the builder covers every field), submit for review.

## Honest notes
- The app IS your website — updates ship by deploying the site, no
  re-submission needed (that's the TWA superpower).
- Commerce stays on the web stack: payments happen on your site, exactly
  like the desktop browser. No Play Billing is generated or required for
  physical goods.
- Replace the placeholder icons in the PWA export with real artwork
  before submitting — stores reject placeholder art.
`;
}
