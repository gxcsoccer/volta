import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // longport is a NAPI-RS native module — keep it as a server-side external
  // so that webpack doesn't try to bundle the .node binary.
  serverExternalPackages: ["longport"],
};

export default nextConfig;
