/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Skip ESLint during production builds (warnings are non-blocking locally
  // but Vercel CI treats them as fatal errors in some configurations)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript type errors during build (tsc --noEmit passes locally)
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'veiethiopia.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'veiethiopia.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
