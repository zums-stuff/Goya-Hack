import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prisma 7 + Pollar 0.11.3 (que importa buffer + crypto): server-only imports
  // NO deben terminar en el bundle del cliente. Next.instrumentationHook queda
  // activo para nuestro carga de `instrumentation.ts` (cron dev, §11.2).
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Next 16: nada experimental extra hoy.
  },
  // Imágenes: las fotos de listing/dispute las servimos desde Vercel Blob o
  // /public/disputes (dev). Foto de listing viene de Unsplash en el seed.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  // Headers: endurecer respuestas con sane defaults.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
