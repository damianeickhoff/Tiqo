import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits exactly on top of the sidebar's sign-out button.
  devIndicators: false,

  experimental: {
    // Attachments travel with the form that carries them, and a server action
    // body is capped at 1 MB by default. One megabyte over the per-file limit
    // in `src/lib/attachments.ts`, so the cap somebody hits is ours and the
    // sentence they read is ours too.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
