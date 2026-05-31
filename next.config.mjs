/** @type {import('next').NextConfig} */
// Production build for Lusik & Sons. The site is served by Next.js on Netlify
// via @netlify/plugin-nextjs (see netlify.toml). The site is built and served
// entirely by Next.js; the old Vite build (index.html / src/main.jsx / App.jsx)
// has been retired and removed.
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
