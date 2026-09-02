/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Brand fonts are loaded via a plain <link> in app/layout.tsx; skip Next's
  // build-time font inlining so builds don't depend on fonts.googleapis.com.
  optimizeFonts: false,
};

module.exports = nextConfig;
