import type { NextConfig } from "next";

const capacitorBuild = process.env.BLUEJURY_BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(capacitorBuild ? { output: "export", trailingSlash: true } : {}),
};

export default nextConfig;
