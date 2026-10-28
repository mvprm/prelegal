import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Built as static files and served by the FastAPI backend (see ../backend).
  output: "export",
  // Emits nda/index.html rather than nda.html, which the backend's static file server
  // resolves directly.
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
