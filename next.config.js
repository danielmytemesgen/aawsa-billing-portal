// next.config.js – simplified configuration for development (no PWA/Workbox)

const publicServerIp = process.env.PUBLIC_SERVER_IP;

const allowedDevOrigins = [
  ...(publicServerIp ? [`http://${publicServerIp}:3000`, `https://${publicServerIp}:3001`] : []),
  'http://localhost:3000',
  'https://localhost:3001',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3001',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_TARGET === 'export' ? 'export' : 'standalone',
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  allowedDevOrigins,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'user-images.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'veiethiopia.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.undp.org', pathname: '/**' },
      { protocol: 'http', hostname: 'www.stronsmart.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.shutterstock.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
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
