import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Postgres local de teste (só em desenvolvimento) fica fora do pacote do servidor
  serverExternalPackages: ['@electric-sql/pglite'],
  cacheComponents: true,
  partialPrefetching: true,
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
