/** @type {import('next').NextConfig} */
// Phase 1 scaffold for the Vite -> Next.js migration. Inert until the
// `next` dependency is installed (see NEXTJS_MIGRATION_PLAN.md). Production
// is still served by the Vite build (netlify.toml publish = "dist") and is
// NOT affected by anything in this file or the app/ directory.
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
