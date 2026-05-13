import type { NextConfig } from 'next';

// Headers de sécurité appliqués globalement.
// Référence CLAUDE.md "Sécurité — règles non négociables" (post-incident
// verger-shop 2026-05-07) : HSTS, X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, Permissions-Policy obligatoires sur tout site Veridian.
const securityHeaders = [
  // Force HTTPS pour 1 an + sous-domaines + preload (HSTS standard)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Bloque le clickjacking via iframe
  { key: 'X-Frame-Options', value: 'DENY' },
  // Bloque le MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limite l'info Referer pour éviter de leak les URLs admin
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Désactive APIs sensibles (caméra, micro, geo) qu'Analytics n'utilise pas
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Securite : ne pas exposer la stack technique dans les headers HTTP.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // POC dev : on sert l'app sur http://100.92.215.42:3100 (Tailscale dev-server)
  // et on l'ouvre depuis le laptop local. Next exige explicitement ces origins
  // pour les assets /_next/* en dev.
  allowedDevOrigins: ['100.92.215.42', 'dev-server-1'],
};

export default nextConfig;
