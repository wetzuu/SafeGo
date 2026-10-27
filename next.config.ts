import type { NextConfig } from "next";

// 127.0.0.1 rather than localhost: on Windows localhost can resolve to IPv6 first, and the local
// Java API listens on IPv4 only.
const JAVA_BACKEND_URL = process.env.JAVA_BACKEND_URL || "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${JAVA_BACKEND_URL}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

