import type { NextConfig } from "next";

const api = process.env.API_BASE_URL?.replace(/\/$/, "");
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    return api ? [{ source: "/api/:path*", destination: `${api}/api/:path*` }] : [];
  },
};

export default config;
