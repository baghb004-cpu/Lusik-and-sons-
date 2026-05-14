// ============================================================
// src/main.jsx — Vite build entrypoint (placeholder)
// ============================================================
// During the migration this file will end up calling
// ReactDOM.createRoot(...).render(<LanguageProvider><App/>...).
//
// Until the data + component extractions happen (see
// CLAUDE.md § Vite migration phases), this is a stub that just
// proves the build pipeline works — render a one-line message
// into a #vite-root div if it exists, otherwise do nothing.
// Production traffic never hits this code path: the running
// site still serves the hand-edited index.html from the repo
// root and netlify.toml hasn't been flipped to publish dist/.
// ============================================================

import "./styles/index.css";

// Defer the import so the stub doesn't pull React into the
// bundle if there's no mount point on the page. Once the
// migration is far enough along to actually mount the SPA,
// this will become the real createRoot call.
const mount = document.getElementById("vite-root");
if (mount) {
  import("react-dom/client").then(({ createRoot }) => {
    createRoot(mount).render(
      "Vite build pipeline is live. Real app extraction comes next."
    );
  });
}
