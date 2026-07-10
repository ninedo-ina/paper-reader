import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  transpilePackages: ['pdfjs-dist'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  webpack: (config) => {
    // pdfjs-dist ESM fails with eval-* devtool (Object.defineProperty called on non-object)
    // Next.js defaults to eval-source-map in dev → switch to cheap-module-source-map
    if (config.devtool && config.devtool.startsWith('eval')) {
      config.devtool = 'cheap-module-source-map'
    }
    return config
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default withNextIntl(nextConfig);
