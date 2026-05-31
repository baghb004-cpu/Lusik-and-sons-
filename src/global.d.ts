// ============================================================
// Ambient asset-module declarations
// ============================================================
// Side-effect + asset imports (CSS, images, fonts) need module
// declarations to satisfy the TypeScript type-check run by `next build`.
// These were previously provided by `vite/client`; kept here,
// framework-agnostic, after retiring Vite so `import "./globals.css"`
// and image/font imports keep type-checking.
// ============================================================
declare module "*.css";
declare module "*.scss";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.webp";
declare module "*.gif";
declare module "*.avif";
declare module "*.woff";
declare module "*.woff2";
