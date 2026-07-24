/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@drip-tv/shared"],
  experimental: {
    typedRoutes: false,
    // Server Actions reject cross-origin POSTs by default. The app is served
    // on both the apex and www hosts (and the vercel.app preview domain), so
    // whitelist all of them or logins submitted from a non-canonical host fail
    // with "Unexpected end of JSON input".
    serverActions: {
      allowedOrigins: [
        "driptv.io",
        "www.driptv.io",
        "drip-tv.vercel.app",
        "drip-tv-git-main-wesleys-projects-36d8a0d3.vercel.app",
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "image.mux.com" },
    ],
  },
};
export default nextConfig;
