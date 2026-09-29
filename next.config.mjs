/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The small stylesheet ships in the HTML: a delayed CSS request cannot hide
  // the server-rendered first screen. Avoids external fonts and CDNs as well.
  experimental: { inlineCss: true },
};
export default config;
