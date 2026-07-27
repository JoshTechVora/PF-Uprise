import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically imports its worker file at
  // runtime; bundling it through webpack/turbopack mangles that path and
  // breaks worker setup. Keep it external so it's require()'d directly
  // from node_modules in the Node runtime instead.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
