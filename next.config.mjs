/** @type {import('next').NextConfig} */
// Production build for Lusik & Sons. The site is served by Next.js on Netlify
// via @netlify/plugin-nextjs (see netlify.toml). The site is built and served
// entirely by Next.js; the old Vite build (index.html / src/main.jsx / App.jsx)
// has been retired and removed.
const nextConfig = {
  reactStrictMode: true,
  // Serve images in the smallest modern format the browser accepts. AVIF first
  // (typically 20–30% smaller than WebP), WebP fallback, then the original.
  // The Netlify image CDN (@netlify/plugin-nextjs) handles the negotiation.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
