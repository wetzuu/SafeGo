import type { NextConfig } from "next";

const JAVA_BACKEND_URL = process.env.JAVA_BACKEND_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
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

