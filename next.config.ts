import type { NextConfig } from "next";

// Cabeçalhos de segurança (painel autenticado): sem moldura em outros sites, sem adivinhar tipo de arquivo, referência mínima, sem sensores, só HTTPS.
const cabecalhosSeguranca = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: cabecalhosSeguranca }];
  },
  /* config options here */
  // Postgres local de teste (só em desenvolvimento) fica fora do pacote do servidor
  serverExternalPackages: ['@electric-sql/pglite'],
  // ...e fora do pacote das funções publicadas (26 MB que só o teste local usa; em produção a variável DMANDA_BANCO=teste é recusada)
  outputFileTracingExcludes: { '/*': ['./node_modules/@electric-sql/pglite/**/*'] },
  // O manifesto e a cor da barra leem src/estilos/catalyst.css (src/lib/cores-barra.ts). Hoje isso acontece na build, mas, se uma página rodar a leitura no servidor
  // da Vercel, o arquivo precisa estar no pacote da função (a leitura é marcada turbopackIgnore e não entra no rastreio sozinha).
  outputFileTracingIncludes: { '/*': ['./src/estilos/catalyst.css'] },
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
