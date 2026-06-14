// ============================================================
// App Developer Mode — PWA export pieces (plan §15: PWA first)
// ============================================================
// Pure generators the exporter writes out: a web manifest themed
// from the site's tokens, a small honest service worker (cache-
// first for same-origin static assets, network-first for pages,
// versioned cache), and the install README. The HTML side
// (manifest link + one tiny registration script) is the ONLY
// JavaScript a PWA export adds over the static one — and the
// plain static target stays zero-JS.
// ============================================================

import type { Theme } from "../schema/index.ts";

export function buildWebManifest(input: { name: string; theme: Theme | null }): string {
  const themeColor = input.theme?.tokens.colors.ink ?? "#1A1612";
  const backgroundColor = input.theme?.tokens.colors.cream ?? "#F5EFE3";
  return JSON.stringify(
    {
      name: input.name,
      short_name: input.name.length > 12 ? input.name.split(/[\s—-]/)[0] : input.name,
      display: "standalone",
      start_url: "/",
      scope: "/",
      theme_color: themeColor,
      background_color: backgroundColor,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2
  );
}

export function buildServiceWorker(version: string): string {
  return `// Generated service worker — offline shell for the PWA export.
// Pages: network-first (fresh when online, cached when not).
// Assets (css/img): cache-first. Cache version: ${version}
const CACHE = "pwa-${version}";
const SHELL = ["/", "/styles.css"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
`;
}

/** The one script a PWA export adds: service-worker registration. */
export const SW_REGISTER_SNIPPET = `<script>if("serviceWorker" in navigator){addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"))}</script>`;

export function buildPwaReadme(name: string): string {
  return `# ${name} — installable PWA export

A static site that installs like an app: offline shell, home-screen icon,
standalone window. Deploy the folder to any static host **over HTTPS**
(service workers require it; localhost works for testing).

## Test it
1. Serve the folder (e.g. \`npx serve .\`) and open it on a phone.
2. iPhone: Share → Add to Home Screen. Android: the install prompt or
   menu → Install app.
3. Airplane mode → open it from the home screen — visited pages still load.

## Icons
Replace the placeholders in /icons (192, 512, and maskable 512 PNG) with
real artwork — same filenames, no other changes needed.

## Honest notes
- The ONLY JavaScript here is the 1-line service-worker registration;
  pages themselves are static HTML/CSS.
- Web push on iOS requires the app to be installed to the home screen
  first, and several native APIs stay out of reach — that's the PWA
  trade. The store checklists in the builder cover the native path if
  you ever need it.
`;
}
