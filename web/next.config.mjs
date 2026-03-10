/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false, // Use Babel when SWC binary is unavailable
  // App Router is stable in Next.js 14, no need for experimental flag
};

export default nextConfig;


