import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM-adjacent packages must stay out of the server bundle.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
