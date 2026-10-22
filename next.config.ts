import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A production build must never write into the directory the dev server is using:
  // `next build` over a live `.next` leaves dev serving HTML that points at chunks
  // which no longer exist -- every page answers 200, every script 404s and the
  // /tattoos/[slug] route throws MODULE_NOT_FOUND. `npm run build` therefore writes
  // to `.next-build`; use `npm run build:deploy` (or NEXT_DIST_DIR=.next) when the
  // output really is the deployable build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // The preview is served through an *.e2b.app proxy; without this Next treats the
  // proxied asset requests as cross-origin and can refuse them in dev.
  allowedDevOrigins: ['*.e2b.app'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600, 1920, 2560],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/textures/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/tattoos/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
