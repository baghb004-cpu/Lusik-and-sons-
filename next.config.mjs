/** @type {import('next').NextConfig} */
// Production build for Lusik & Sons. The site is served by Next.js on Netlify
// via @netlify/plugin-nextjs (see netlify.toml). The legacy Vite entry
// (index.html / src/main.jsx) is retained only for local tooling + the e2e
// smoke suite and is not deployed.
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
