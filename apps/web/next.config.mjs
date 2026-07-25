/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for the production Docker image (docker/web.Dockerfile).
  output: "standalone",
  transpilePackages: ["@volt/config", "@volt/validation", "@volt/types"],
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;
