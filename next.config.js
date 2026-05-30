// next.config.js – simplified configuration for development (no PWA/Workbox)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_TARGET === 'export' ? 'export' : 'standalone',
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  images: {
    domains: ['veiethiopia.com', 'www.shutterstock.com', 'lh3.googleusercontent.com'],
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'user-images.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'veiethiopia.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.undp.org', pathname: '/**' },
      { protocol: 'http', hostname: 'www.stronsmart.com', pathname: '/**' },
    ],
  },

  webpack: (config, { isServer }) => {
    if (process.env.NEXT_BUILD_TARGET === 'export') {
      config.resolve.alias['@/lib/actions'] = require('path').resolve(__dirname, 'src/lib/actions-mock.ts');
    }
    if (isServer) {
      config.ignoreWarnings = [{ module: /@opentelemetry\/exporter-jaeger/ }];
      config.resolve.alias = { ...config.resolve.alias, '@opentelemetry/exporter-jaeger': false };
    }
    return config;
  },
};

module.exports = nextConfig;
