import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives inside a multi-project repo; pin the workspace root so
  // Next does not walk up and pick the parent lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Real photography can be dropped in from these hosts without a code change.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
