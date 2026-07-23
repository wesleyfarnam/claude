/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@drip-tv/shared"],
  experimental: { typedRoutes: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "image.mux.com" },
    ],
  },
};
export default nextConfig;
