import type { NextConfig } from 'next';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.100', '192.168.0.106', '192.168.0.*'],
  async rewrites() {
    return [
      {
        source: '/ws',
        destination: `${BACKEND_URL}/ws`,
      },
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  transpilePackages: [],
};

export default nextConfig;
